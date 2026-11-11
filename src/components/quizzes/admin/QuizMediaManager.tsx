"use client";

import { useEffect, useId, useState } from "react";
import { QUIZ_MEDIA_UPLOAD } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { toUserMessage } from "@/lib/errors";
import { listQuizMedia, quizMediaPath, quizMediaProblem, uploadQuizMedia } from "@/lib/quiz/media";
import { QuizImage } from "../QuestionPreview";

interface PendingFile {
  file: File;
  path: string;
  problem: string | null;
  progress: number;
  state: "ready" | "uploading" | "done" | "error";
  error: string;
}

/**
 * Sınav görselleri (F5.2): `quiz_media/` altına toplu yükleme (ilerleme çubuğuyla). Aynı adlı görsel
 * ÜZERİNE YAZILMAZ: yayındaki bir sınavın görseli sessizce değişmesin. Yüklenen yol CSV'nin 2. sütununa yazılır.
 */
export function QuizMediaManager() {
  const toast = useToast();
  const inputId = useId();
  const [existing, setExisting] = useState<string[] | null>(null);
  const [listError, setListError] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);

  async function refresh() {
    try {
      setListError("");
      setExisting(await listQuizMedia());
    } catch (err) {
      setListError(toUserMessage(err));
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  function pick(files: FileList | null) {
    const taken = new Set(existing ?? []);
    const chosen = new Set<string>();
    setPending(
      [...(files ?? [])].map((file) => {
        let path = "";
        let problem = quizMediaProblem(file);
        if (!problem) {
          path = quizMediaPath(file.name, file.type);
          if (taken.has(path)) problem = `Bu adla bir görsel zaten var (${path}). Dosyayı yeniden adlandırın.`;
          else if (chosen.has(path)) problem = `Seçimde aynı ada dönüşen iki dosya var (${path}).`;
          chosen.add(path);
        }
        return { file, path, problem, progress: 0, state: problem ? "error" : "ready", error: problem ?? "" };
      })
    );
  }

  async function uploadAll() {
    setUploading(true);
    let ok = 0;
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      if (item.state !== "ready") continue;
      const update = (patch: Partial<PendingFile>) =>
        setPending((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
      update({ state: "uploading" });
      try {
        await uploadQuizMedia(item.file, item.path, (progress) => update({ progress }));
        update({ state: "done", progress: 1 });
        ok++;
      } catch (err) {
        update({ state: "error", error: toUserMessage(err) });
      }
    }
    setUploading(false);
    if (ok) toast.show(`${ok} görsel yüklendi.`, { tone: "success" });
    await refresh();
  }

  const readyCount = pending.filter((p) => p.state === "ready").length;

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      toast.show(`Kopyalandı: ${path}`, { tone: "success" });
    } catch {
      toast.show("Pano erişimi yok; yolu elle seçip kopyalayın.", { tone: "warning" });
    }
  }

  return (
    <div className="attendance-admin">
      <Card
        title="Görsel yükle"
        description={`PNG, JPEG, WebP veya GIF; en fazla ${QUIZ_MEDIA_UPLOAD.maxMb} MB. Yüklenen yolu CSV'nin "Soru Görseli" sütununa yazın.`}
      >
        <div className="auth-stack">
          <div className="form-group">
            <label htmlFor={inputId} className="form-label">
              Görsel dosyaları
            </label>
            <input
              id={inputId}
              type="file"
              multiple
              accept={QUIZ_MEDIA_UPLOAD.contentTypes.join(",")}
              className="form-input"
              disabled={uploading}
              onChange={(e) => pick(e.target.files)}
            />
          </div>
          {pending.length > 0 && (
            <ul className="upload-list" aria-label="Yüklenecek görseller">
              {pending.map((p) => (
                <li key={`${p.file.name}-${p.path}`}>
                  <div className="upload-row">
                    <span>{p.file.name}</span>
                    {p.path && <code>{p.path}</code>}
                    {p.state === "done" && <StatusChip tone="success">Yüklendi</StatusChip>}
                    {p.state === "error" && <StatusChip tone="critical">Yüklenemedi</StatusChip>}
                  </div>
                  {(p.state === "uploading" || p.state === "done") && (
                    <progress max={1} value={p.progress} aria-label={`${p.file.name} yükleniyor`} />
                  )}
                  {p.state === "error" && <p className="ui-field-error">{p.error}</p>}
                </li>
              ))}
            </ul>
          )}
          <div className="ui-actions">
            <Button
              onClick={() => void uploadAll()}
              loading={uploading}
              loadingText="Yükleniyor…"
              disabled={readyCount === 0}
            >
              {readyCount ? `${readyCount} görseli yükle` : "Yükle"}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Yüklü görseller" description="Bu yollar CSV'de kullanılabilir.">
        {listError && <Alert tone="critical">{listError}</Alert>}
        <DataTable<string>
          caption="Yüklü sınav görselleri"
          captionHidden
          columns={[
            {
              key: "thumb",
              header: <span className="sr-only">Önizleme</span>,
              cell: (path) => <QuizImage path={path} alt="" className="quiz-thumb" />,
            },
            { key: "path", header: "Yol", rowHeader: true, cell: (path) => <code>{path}</code> },
            {
              key: "copy",
              header: <span className="sr-only">İşlem</span>,
              align: "end",
              cell: (path) => (
                <Button size="sm" variant="secondary" onClick={() => void copy(path)}>
                  Yolu kopyala<span className="sr-only"> ({path})</span>
                </Button>
              ),
            },
          ]}
          rows={existing ?? []}
          rowKey={(p) => p}
          loading={existing === null && !listError}
          empty={<EmptyState title="Henüz görsel yok" />}
        />
      </Card>
    </div>
  );
}
