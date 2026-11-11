"use client";

import type { CallableResponse } from "@shared/schemas";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { QuizImage, questionTypeLabel } from "../QuestionPreview";

export type ReportData = Pick<
  CallableResponse<"getAttemptReport">,
  "score" | "correctCount" | "totalQuestions" | "lateSubmission" | "revealed" | "revealAtMs" | "items"
> & { autoSubmitted?: boolean; timedOut?: boolean; quizTitle?: string };

const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

/**
 * Sınav karnesi (F5.3; ayrıntılar F5.4). Doğru cevaplar ve öğrenme notları yalnızca sunucu açtıysa vardır
 * (D7); kapalıysa ne zaman açılacağı söylenir. Doğru/yanlış renge ek olarak metinle belirtilir.
 */
export function AttemptReport({ report, title }: { report: ReportData; title: string }) {
  return (
    <Card
      title={title}
      description={`${report.correctCount} / ${report.totalQuestions} doğru`}
      actions={
        <span className="report-score mono-num" aria-label={`Puan ${report.score} / 100`}>
          {report.score}
        </span>
      }
    >
      <div className="auth-stack">
        {report.timedOut && (
          <Alert tone="info" title="Süre doldu">
            Sınav süresi bittiği için o ana kadar verdiğiniz yanıtlar otomatik olarak teslim edildi.
          </Alert>
        )}
        {report.autoSubmitted && (
          <Alert tone="info">Süre dolduğunda süre içinde kaydedilmiş yanıtlarınızla otomatik teslim edildi.</Alert>
        )}
        {report.lateSubmission && (
          <Alert tone="warning">Teslim süreden sonra ulaştı; süre içinde kaydedilmiş yanıtlarınız puanlandı.</Alert>
        )}
        {!report.revealed && (
          <Alert tone="info" title="Doğru cevaplar henüz kapalı">
            {report.revealAtMs
              ? `Doğru cevaplar ve öğrenme notları ${dateTime.format(report.revealAtMs)} itibarıyla açılacak.`
              : "Doğru cevaplar ve öğrenme notları sınav kapandığında açılacak."}{" "}
            Şimdilik hangi soruları doğru yanıtladığınızı görebilirsiniz.
          </Alert>
        )}
        <ol className="report-items">
          {report.items.map((item, i) => (
            <li key={item.questionId}>
              <article className="question-preview" aria-labelledby={`report-q-${i}`}>
                <header className="question-preview-header">
                  <h3 id={`report-q-${i}`}>
                    Soru {i + 1} <span className="page-header-subtitle">· {questionTypeLabel(item.questionType)}</span>
                  </h3>
                  <StatusChip tone={item.isCorrect ? "success" : "critical"}>
                    {item.isCorrect ? "Doğru" : "Yanlış"}
                  </StatusChip>
                </header>
                <p className="question-case">{item.caseContent}</p>
                {item.imageUrl && <QuizImage path={item.imageUrl} alt={`Soru ${i + 1} görseli`} />}
                <p className="question-text">{item.questionText}</p>
                <p>
                  <strong>Yanıtınız:</strong> {item.userResponse.length ? item.userResponse.join(" · ") : "(yanıt yok)"}
                </p>
                {item.correctAnswers && (
                  <p>
                    <strong>Doğru cevap:</strong> {item.correctAnswers.join(" · ")}
                  </p>
                )}
                {item.feedbackText && (
                  <p className="question-key">
                    <strong>Öğrenme noktası:</strong> {item.feedbackText}
                  </p>
                )}
              </article>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
