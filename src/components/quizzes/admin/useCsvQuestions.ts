"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LIMITS } from "@shared/constants";
import { validateQuizQuestion, type NormalizedQuizQuestion, type QuizQuestionIssue } from "@shared/quizQuestion";
import { MAX_CSV_BYTES } from "@shared/quizCsv";
import { parseNineFieldQuizCsv, type CsvRowError } from "@/lib/quiz-parser";
import { listQuizMedia } from "@/lib/quiz/media";
import { draftFromForm, formFromDraft, formSignature, localId, type QuestionForm } from "@/lib/quiz/questionForm";
import { toUserMessage } from "@/lib/errors";

/** Önizlemedeki bir soru (F14). Anahtar kalıcıdır: sıra değişince düzenleme durumu ve odak kaybolmaz. */
interface StoredItem {
  key: string;
  /** CSV'deki fiziksel satır (başlık = 1). */
  sourceRow: number;
  form: QuestionForm;
  initialSignature: string;
  /**
   * Bozuk JSON hücresi hataları: şema doğrulaması ancak satır düzenlenince (veya "Bitti" ile onaylanınca)
   * çalışır; o zamana kadar CSV hatası gösterilir.
   */
  pendingCsvIssues: QuizQuestionIssue[];
}

export interface QuestionItem extends StoredItem {
  /** Gösterim sırası (1'den). */
  number: number;
  issues: QuizQuestionIssue[];
  question: NormalizedQuizQuestion | null;
  edited: boolean;
}

/** Hata özeti satırı (CSV satırıyla; "Soruya git" için anahtarla). */
export interface QuestionIssueRow extends CsvRowError {
  key: string | null;
  number: number | null;
}

type MediaCheck = "idle" | "checking" | "done" | "error";

interface State {
  fileName: string;
  /** Dosya düzeyindeki hatalar (boyut, başlık): bu durumda düzenlenecek soru yoktur. */
  fileErrors: CsvRowError[];
  items: StoredItem[];
  initialOrder: string[];
  /** Storage'da olduğu bilinen görsel yolları (liste + önizlemede yüklenen/seçilenler). */
  knownMedia: Set<string>;
  mediaCheck: MediaCheck;
  mediaError: string;
}

const EMPTY: State = {
  fileName: "",
  fileErrors: [],
  items: [],
  initialOrder: [],
  knownMedia: new Set(),
  mediaCheck: "idle",
  mediaError: "",
};

function validate(item: StoredItem) {
  if (item.pendingCsvIssues.length) return { question: null, issues: item.pendingCsvIssues };
  return validateQuizQuestion(draftFromForm(item.form));
}

/**
 * CSV dosyasını sunucuyla AYNI ortak doğrulayıcıyla okur, görsellerin Storage'da olup olmadığını denetler
 * ve (F14) önizlemede soruların düzenlenmesini sağlar: her değişiklikte aynı şema yeniden çalışır.
 * "Taslağı düzenle" diyaloğu düzenleme eylemlerini kullanmaz; davranışı değişmez.
 */
export function useCsvQuestions() {
  const [state, setState] = useState<State>(EMPTY);

  async function load(file: File | null) {
    if (!file) {
      setState(EMPTY);
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setState({
        ...EMPTY,
        fileName: file.name,
        fileErrors: [{ row: 0, field: "Dosya", message: "Dosya 2 MB sınırını aşıyor." }],
      });
      return;
    }
    const parsed = parseNineFieldQuizCsv(await file.text());
    const items: StoredItem[] = parsed.rows.map((row) => {
      const form = formFromDraft(row.draft);
      // Şemanın üretmediği hata = CSV'ye özgü (bozuk JSON hücresi). Satır düzenlenene kadar o gösterilir.
      const schema = new Set(validateQuizQuestion(row.draft).issues.map((i) => `${i.label}|${i.message}`));
      const csvOnly = row.errors.some((e) => !schema.has(`${e.field}|${e.message}`));
      return {
        key: localId("q"),
        sourceRow: row.row,
        form,
        initialSignature: formSignature(form),
        pendingCsvIssues: csvOnly ? row.errors.map((e) => ({ field: "", label: e.field, message: e.message })) : [],
      };
    });
    setState({
      ...EMPTY,
      fileName: file.name,
      fileErrors: parsed.rows.length === 0 ? parsed.errors : [],
      items,
      initialOrder: items.map((i) => i.key),
      mediaCheck: items.some((i) => i.form.imageUrl) ? "checking" : "done",
    });
  }

  const checking = state.mediaCheck === "checking";
  useEffect(() => {
    if (!checking) return;
    let cancelled = false;
    listQuizMedia().then(
      (existing) =>
        !cancelled &&
        setState((s) => ({ ...s, knownMedia: new Set([...s.knownMedia, ...existing]), mediaCheck: "done" })),
      (err: unknown) => !cancelled && setState((s) => ({ ...s, mediaCheck: "error", mediaError: toUserMessage(err) }))
    );
    return () => {
      cancelled = true;
    };
  }, [checking]);

  // --- Düzenleme eylemleri (yalnızca "Yeni sınav" önizlemesi, D29) ---------------------------------

  const mutate = useCallback((key: string, fn: (item: StoredItem) => StoredItem) => {
    setState((s) => ({ ...s, items: s.items.map((i) => (i.key === key ? fn(i) : i)) }));
  }, []);

  /** Formu değiştirir; bekleyen CSV (JSON) hatası düşer ve şema doğrulaması devreye girer. */
  const update = useCallback(
    (key: string, form: QuestionForm) => mutate(key, (i) => ({ ...i, form, pendingCsvIssues: [] })),
    [mutate]
  );

  /** Kullanıcı satırı gözden geçirdi ("Bitti"): bekleyen CSV hatası yerine şema sonucu gösterilir. */
  const confirm = useCallback((key: string) => mutate(key, (i) => ({ ...i, pendingCsvIssues: [] })), [mutate]);

  /** Görseli bağlar/kaldırır. Yol, Storage'da olduğu bilinen (yüklenmiş ya da listeden seçilmiş) bir yoldur. */
  const setImage = useCallback((key: string, path: string) => {
    setState((s) => ({
      ...s,
      knownMedia: path ? new Set([...s.knownMedia, path]) : s.knownMedia,
      items: s.items.map((i) => (i.key === key ? { ...i, form: { ...i.form, imageUrl: path } } : i)),
    }));
  }, []);

  const move = useCallback((key: string, delta: -1 | 1) => {
    setState((s) => {
      const from = s.items.findIndex((i) => i.key === key);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= s.items.length) return s;
      const items = [...s.items];
      [items[from], items[to]] = [items[to], items[from]];
      return { ...s, items };
    });
  }, []);

  const remove = useCallback((key: string) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.key !== key) }));
  }, []);

  const retryMediaCheck = useCallback(() => setState((s) => ({ ...s, mediaCheck: "checking", mediaError: "" })), []);

  // --- Türetilen değerler ---------------------------------------------------------------------------

  const derived = useMemo(() => {
    const items: QuestionItem[] = state.items.map((item, index) => {
      const v = validate(item);
      return {
        ...item,
        number: index + 1,
        issues: v.issues,
        question: v.question,
        edited: formSignature(item.form) !== item.initialSignature,
      };
    });
    const issueRows: QuestionIssueRow[] = [
      ...state.fileErrors.map((e) => ({ ...e, key: null, number: null })),
      ...items.flatMap((item) =>
        item.issues.map((issue) => ({
          row: item.sourceRow,
          field: issue.label,
          message: issue.message,
          key: item.key,
          number: item.number,
        }))
      ),
    ];
    const missingMedia =
      state.mediaCheck === "done"
        ? items
            .filter((i) => i.form.imageUrl && !state.knownMedia.has(i.form.imageUrl))
            .map((i) => ({ row: i.sourceRow, path: i.form.imageUrl, key: i.key, number: i.number }))
        : [];
    const order = state.items.map((i) => i.key);
    const editedInPreview =
      items.some((i) => i.edited) ||
      order.length !== state.initialOrder.length ||
      order.some((k, idx) => k !== state.initialOrder[idx]);
    const { min, max } = LIMITS.quizQuestions;
    const countProblem =
      state.fileName && state.fileErrors.length === 0 && (items.length < min || items.length > max)
        ? items.length < min
          ? `Sınavda en az ${min} soru olmalı.`
          : `Sınavda en fazla ${max} soru olabilir (şu an ${items.length}).`
        : "";
    const ready =
      items.length >= min &&
      items.length <= max &&
      issueRows.length === 0 &&
      state.mediaCheck === "done" &&
      missingMedia.length === 0;
    return {
      items,
      issueRows,
      missingMedia,
      editedInPreview,
      countProblem,
      ready,
      questions: items.flatMap((i) => (i.question ? [i.question] : [])),
    };
  }, [state]);

  return {
    fileName: state.fileName,
    mediaCheck: state.mediaCheck,
    mediaError: state.mediaError,
    ...derived,
    /** Geriye dönük: hata tablosu satırları (`CsvRowError`). */
    errors: derived.issueRows as CsvRowError[],
    /** Önizlemede değişiklik var (sayfadan çıkış uyarısı, yeni CSV onayı). */
    dirty: derived.editedInPreview,
    load,
    reset: () => setState(EMPTY),
    update,
    confirm,
    setImage,
    move,
    remove,
    retryMediaCheck,
  };
}

export type CsvQuestions = ReturnType<typeof useCsvQuestions>;
