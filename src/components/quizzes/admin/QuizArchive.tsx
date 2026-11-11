"use client";

import { useEffect, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { downloadCsv } from "@/lib/csv";
import { toUserMessage } from "@/lib/errors";
import { NINE_FIELD_CSV_HEADERS, toNineFieldCsvRows } from "@/lib/quiz-parser";
import { fetchArchivePage, type ArchivedQuestion } from "@/lib/quiz/admin";
import { toDateInput } from "@/lib/attendance/reports";
import { questionTypeLabel } from "../QuestionPreview";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });

/**
 * Soru arşivi (F5.2): kapanan sınavların 9 alanlı soruları (sayfalı). CSV dışa aktarımı içe aktarma
 * biçimindedir: dosya düzenlenip "Yeni sınav"dan yeniden yüklenebilir (kaynak sütunları 9. sütundan sonra).
 */
export function QuizArchive() {
  const [items, setItems] = useState<ArchivedQuestion[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load(after: QueryDocumentSnapshot | null) {
    setStatus("loading");
    try {
      const page = await fetchArchivePage(after);
      setItems((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.cursor);
      setStatus("ready");
    } catch (err) {
      setError(toUserMessage(err));
      setStatus("error");
    }
  }
  useEffect(() => {
    void load(null);
  }, []);

  const term = search.trim().toLocaleLowerCase("tr");
  const rows = term
    ? items.filter((q) =>
        [q.sourceQuizTitle, q.questionText, q.caseContent].some((t) => t.toLocaleLowerCase("tr").includes(term))
      )
    : items;

  function exportCsv() {
    downloadCsv(
      `soru-arsivi-${toDateInput(new Date())}.csv`,
      [...NINE_FIELD_CSV_HEADERS, "Kaynak sınav", "Arşivlenme"],
      toNineFieldCsvRows(rows).map((r, i) => [
        ...r,
        rows[i].sourceQuizTitle,
        rows[i].archivedAtMs ? toDateInput(new Date(rows[i].archivedAtMs!)) : "",
      ])
    );
  }

  return (
    <Card
      title="Soru arşivi"
      description="Kapanan sınavların soruları cevap anahtarıyla saklanır. Dışa aktarılan CSV yeniden içe aktarılabilir."
      actions={
        <Button
          variant="secondary"
          onClick={exportCsv}
          disabled={rows.length === 0}
          aria-label="Listelenen arşiv sorularını CSV olarak indir"
        >
          CSV indir ({rows.length})
        </Button>
      }
    >
      <div className="auth-stack">
        {status === "error" && <Alert tone="critical">{error}</Alert>}
        <Field label="Ara" hint="Sınav adı, vaka veya soru metninde (yüklenen sayfalarda) arar.">
          {(p) => (
            <input
              {...p}
              type="search"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </Field>
        <DataTable<ArchivedQuestion>
          caption="Arşivlenmiş sorular"
          captionHidden
          columns={[
            {
              key: "date",
              header: "Arşivlenme",
              cell: (q) => (q.archivedAtMs ? dateFormat.format(q.archivedAtMs) : "—"),
            },
            { key: "quiz", header: "Kaynak sınav", cell: (q) => q.sourceQuizTitle },
            { key: "question", header: "Soru", rowHeader: true, cell: (q) => q.questionText },
            { key: "type", header: "Tip", cell: (q) => questionTypeLabel(q.questionType) },
            { key: "answer", header: "Doğru cevap", cell: (q) => q.correctAnswers.join(" · ") },
          ]}
          rows={rows}
          rowKey={(q) => q.id}
          loading={status === "loading" && items.length === 0}
          error={status === "error" && items.length === 0 ? error : undefined}
          empty={<EmptyState title={term ? "Aramayla eşleşen soru yok" : "Arşiv boş"} />}
        />
        {cursor && (
          <div className="ui-actions">
            <Button
              variant="secondary"
              onClick={() => void load(cursor)}
              loading={status === "loading"}
              loadingText="Yükleniyor…"
            >
              Daha fazla yükle
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
