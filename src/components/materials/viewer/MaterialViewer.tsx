"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import type { ClinicMemberSession } from "@/lib/auth/types";
import { toUserMessage } from "@/lib/errors";
import { FILE_TYPE_LABEL, type MaterialView } from "@/lib/materials/admin";
import { canComplete, createProgressSaver, writeProgress, type MyProgress } from "@/lib/materials/doctor";
import { useStorageUrl } from "@/lib/quiz/media";
import { PdfViewer } from "./PdfViewer";
import { watermarkText } from "./watermark";

/** Görünür sekmede geçen süre bu aralıkla kaydedilir (ve kapanışta). */
export const PROGRESS_SAVE_MS = 15_000;

/**
 * Filigranlı görüntüleme (F6.3, D11): PDF (pdf.js, filigran canvas'a yakılı), video, görsel. İlerleme: yalnızca
 * sekme GÖRÜNÜRKEN geçen süre ve en uzak sayfa, `progress/{uid}`'e düzenli yazılır. "Tamamlandı" ancak son sayfa
 * görülünce / video %90 izlenince açılır. İndirme yalnızca admin izin verdiyse. Storage yolu gösterilmez.
 */
export function MaterialViewer({
  material,
  session,
  saved,
  onClose,
}: {
  material: MaterialView;
  session: ClinicMemberSession;
  saved: MyProgress;
  onClose: () => void;
}) {
  const toast = useToast();
  const url = useStorageUrl(material.storagePath);
  const [page, setPage] = useState(Math.max(1, saved.lastPage));
  const [pageCount, setPageCount] = useState(0);
  const [maxPage, setMaxPage] = useState(saved.lastPage);
  const [watched, setWatched] = useState(0);
  const [completed, setCompleted] = useState(saved.completed);
  const [saveError, setSaveError] = useState("");
  const [completing, setCompleting] = useState(false);
  const stateRef = useRef({ page, completed });
  stateRef.current = { page: maxPage || page, completed };
  const watermark = useMemo(
    () => watermarkText(`${session.title} ${session.fullName}`.trim(), session.email, Date.now()),
    [session.title, session.fullName, session.email]
  );

  // Yazmalar sırayla (F13.4): düzenli kayıt sürerken "Tamamlandı" gelirse saniyeler kaybolmaz.
  // `saved` yalnızca açılıştaki değerdir; görüntüleyici açıkken kaydedici kendi son yazımını esas alır.
  const savedAtOpen = useRef(saved);
  const saver = useMemo(
    () =>
      createProgressSaver({
        saved: savedAtOpen.current,
        current: () => stateRef.current,
        write: (value) => writeProgress(material.id, session.uid, value),
      }),
    [material.id, session.uid]
  );

  const flush = useCallback(
    () =>
      saver.flush().then(
        () => setSaveError(""),
        (err: unknown) => {
          setSaveError(toUserMessage(err)); // gönderilemeyen süre sonraki kayıtta yeniden gönderilir
          throw err;
        }
      ),
    [saver]
  );

  // Yalnızca görünür sekmede süre say; düzenli ve kapanışta kaydet.
  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") saver.addSeconds(1);
    }, 1000);
    const save = window.setInterval(() => void flush().catch(() => undefined), PROGRESS_SAVE_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(save);
      document.removeEventListener("visibilitychange", onHide);
      void flush().catch(() => undefined);
    };
  }, [flush, saver]);

  const onPage = useCallback((p: number, total: number) => {
    setPage(p);
    setPageCount(total);
    setMaxPage((m) => Math.max(m, p));
  }, []);

  const completable = canComplete(material.fileType, { maxPage, pageCount, watchedFraction: watched });

  async function markCompleted() {
    setCompleting(true);
    stateRef.current = { ...stateRef.current, completed: true };
    try {
      await flush();
      setCompleted(true);
      toast.show("Materyal tamamlandı olarak kaydedildi.", { tone: "success" });
    } catch {
      stateRef.current = { ...stateRef.current, completed: false };
    } finally {
      setCompleting(false);
    }
  }

  const hint =
    material.fileType === "pdf"
      ? pageCount
        ? `Tamamlamak için son sayfaya kadar okuyun (${Math.min(maxPage, pageCount)} / ${pageCount}).`
        : ""
      : material.fileType === "video"
        ? `Tamamlamak için videonun en az %90'ını izleyin (%${Math.round(watched * 100)}).`
        : "";

  return (
    <Card
      title={material.title}
      description={[...material.labels, FILE_TYPE_LABEL[material.fileType], "Filigranlı görüntüleme"].join(" · ")}
      actions={
        <span className="ui-actions">
          {completed && <StatusChip tone="success">Tamamlandı</StatusChip>}
          <Button variant="secondary" onClick={onClose}>
            Listeye dön
          </Button>
        </span>
      }
    >
      <div className="auth-stack">
        {material.description && <p>{material.description}</p>}
        {saveError && (
          <Alert tone="warning">İlerleme kaydedilemedi: {saveError} Bağlantı gelince yeniden denenecek.</Alert>
        )}
        {url.status === "error" && <Alert tone="critical">{url.error}</Alert>}
        {url.status === "loading" && <p className="page-header-subtitle">Materyal açılıyor…</p>}
        {url.status === "ready" && material.fileType === "pdf" && (
          <PdfViewer url={url.url} title={material.title} watermark={watermark} initialPage={page} onPage={onPage} />
        )}
        {url.status === "ready" && material.fileType === "video" && (
          <div className="media-frame" onContextMenu={(e) => e.preventDefault()}>
            <video
              src={url.url}
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              preload="metadata"
              aria-label={material.title}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                // `timeupdate` saniyede birkaç kez gelir; durum yalnızca %1'lik adımlarda değişir (F8.2:
                // görüntüleyicinin her olayda yeniden çizilmesini önler; eşik %90, adım yeterince ince).
                if (v.duration > 0) {
                  const fraction = Math.floor((v.currentTime / v.duration) * 100) / 100;
                  setWatched((w) => (fraction > w ? fraction : w));
                }
              }}
            >
              <track kind="captions" />
            </video>
            <div className="watermark-overlay" aria-hidden="true">
              {watermark}
            </div>
          </div>
        )}
        {url.status === "ready" && material.fileType === "image" && (
          <div className="media-frame" onContextMenu={(e) => e.preventDefault()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url.url} alt={material.title} />
            <div className="watermark-overlay" aria-hidden="true">
              {watermark}
            </div>
          </div>
        )}

        <div className="ui-actions">
          {!completed && (
            <Button
              onClick={() => void markCompleted()}
              disabled={!completable}
              loading={completing}
              loadingText="Kaydediliyor…"
            >
              Tamamlandı olarak işaretle
            </Button>
          )}
          {!completed && hint && <span className="page-header-subtitle">{hint}</span>}
          {material.allowDownload && url.status === "ready" && (
            <a className="btn btn-secondary" href={url.url} target="_blank" rel="noopener" download>
              İndir
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
