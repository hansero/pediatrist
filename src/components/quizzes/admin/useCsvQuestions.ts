"use client";

import { useEffect, useState } from "react";
import type { NormalizedQuizQuestion } from "@shared/quizQuestion";
import { MAX_CSV_BYTES } from "@shared/quizCsv";
import { parseNineFieldQuizCsv, type CsvRowError } from "@/lib/quiz-parser";
import { listQuizMedia } from "@/lib/quiz/media";
import { toUserMessage } from "@/lib/errors";

export interface CsvQuestionsState {
  fileName: string;
  questions: NormalizedQuizQuestion[];
  errors: CsvRowError[];
  /** CSV'nin başvurduğu ama Storage'da olmayan görsel yolları (satır numarasıyla). */
  missingMedia: { row: number; path: string }[];
  mediaCheck: "idle" | "checking" | "done" | "error";
  mediaError: string;
}

const EMPTY: CsvQuestionsState = {
  fileName: "",
  questions: [],
  errors: [],
  missingMedia: [],
  mediaCheck: "idle",
  mediaError: "",
};

/**
 * CSV dosyasını sunucuyla AYNI ortak doğrulayıcıyla (`parseNineFieldQuizCsv`) okur ve görsellerin Storage'da
 * olup olmadığını denetler (sunucu da kayıtta denetler; burada erken ve satır numaralı geri bildirim için).
 */
export function useCsvQuestions() {
  const [state, setState] = useState<CsvQuestionsState>(EMPTY);

  async function load(file: File | null) {
    if (!file) {
      setState(EMPTY);
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setState({
        ...EMPTY,
        fileName: file.name,
        errors: [{ row: 0, field: "Dosya", message: "Dosya 2 MB sınırını aşıyor." }],
      });
      return;
    }
    const text = await file.text();
    const parsed = parseNineFieldQuizCsv(text);
    setState({
      ...EMPTY,
      fileName: file.name,
      questions: parsed.questions,
      errors: parsed.errors,
      mediaCheck: parsed.questions.some((q) => q.imageUrl) ? "checking" : "done",
    });
  }

  const paths = state.questions.map((q) => q.imageUrl).join("\n");
  useEffect(() => {
    if (state.mediaCheck !== "checking") return;
    let cancelled = false;
    listQuizMedia().then(
      (existing) => {
        if (cancelled) return;
        const have = new Set(existing);
        const missing = state.questions
          .map((q, i) => ({ row: i + 2, path: q.imageUrl }))
          .filter((m) => m.path && !have.has(m.path));
        setState((s) => ({ ...s, missingMedia: missing, mediaCheck: "done" }));
      },
      (err: unknown) => !cancelled && setState((s) => ({ ...s, mediaCheck: "error", mediaError: toUserMessage(err) }))
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, state.mediaCheck]);

  const ready =
    state.questions.length > 0 &&
    state.errors.length === 0 &&
    state.mediaCheck === "done" &&
    state.missingMedia.length === 0;

  return { ...state, ready, load, reset: () => setState(EMPTY) };
}
