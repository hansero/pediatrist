"use client";

import React, { useId, useRef, useState } from "react";
import { MATERIAL_UPLOAD } from "@shared/constants";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { toUserMessage } from "@/lib/errors";
import { createMaterial, deleteMaterial, finalizeMaterialUpload } from "@/lib/firebase/callables";
import { formatBytes, materialFileProblem, runMaterialUpload, uploadMaterialFile } from "@/lib/materials/admin";
import {
  emptyMaterialFields,
  MaterialFields,
  validateMaterialFields,
  type MaterialFieldErrors,
  type MaterialFieldsValue,
} from "./MaterialFields";

type Phase = "idle" | "creating" | "uploading" | "verifying";

/**
 * Materyal yükleme (F6.2): taslak (`createMaterial`) → Storage'a yükleme (ilerleme, iptal) → sunucuda doğrulama
 * ve yayın (`finalizeMaterialUpload`). İptal veya hata olursa yarım taslak silinir (`runMaterialUpload`).
 * Başarı yalnızca sunucu yayınladıktan sonra gösterilir.
 */
export function MaterialUploadForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const fileId = useId();
  const [fields, setFields] = useState<MaterialFieldsValue>(emptyMaterialFields);
  const [errors, setErrors] = useState<MaterialFieldErrors & { file?: string }>({});
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const cancelRef = useRef<(() => void) | null>(null);
  const busy = phase !== "idle";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found: MaterialFieldErrors & { file?: string } = validateMaterialFields(fields);
    if (!file) found.file = "Dosya seçin.";
    else {
      const problem = materialFileProblem(file);
      if (problem) found.file = problem;
    }
    setErrors(found);
    if (Object.keys(found).length || !file) return;

    setError("");
    setProgress(0);
    setPhase("creating");
    try {
      await runMaterialUpload({
        create: () =>
          createMaterial({
            ...fields,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        upload: async (storagePath) => {
          setPhase("uploading");
          const handle = uploadMaterialFile(file, storagePath, setProgress);
          cancelRef.current = handle.cancel;
          try {
            await handle.promise;
          } finally {
            cancelRef.current = null;
          }
          setPhase("verifying");
        },
        finalize: (materialId) => finalizeMaterialUpload({ materialId }),
        discard: (materialId) => deleteMaterial({ materialId }),
      });
      toast.show(`"${fields.title.trim()}" yayınlandı; hedef kıdemdeki hekimler görebilir.`, { tone: "success" });
      setFields(emptyMaterialFields());
      setFile(null);
      onDone();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPhase("idle");
    }
  }

  return (
    <Card
      title="Materyal yükle"
      description={`PDF, video (MP4/WebM/MOV) veya görsel (PNG/JPEG/WebP); en fazla ${MATERIAL_UPLOAD.maxMb} MB. Sunumları PDF olarak kaydedip yükleyin.`}
    >
      <form className="auth-stack" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="critical">{error}</Alert>}
        <div className="form-group">
          <label htmlFor={fileId} className="form-label">
            Dosya
            <span className="ui-required" aria-hidden="true">
              {" "}
              *
            </span>
          </label>
          <input
            id={fileId}
            type="file"
            className="form-input"
            accept={Object.keys(MATERIAL_UPLOAD.contentTypes).join(",")}
            disabled={busy}
            aria-invalid={errors.file ? true : undefined}
            aria-describedby={errors.file ? `${fileId}-error` : undefined}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              const problem = f ? materialFileProblem(f) : null;
              setFile(f);
              setErrors((x) => ({ ...x, file: problem ?? undefined }));
              // Başlık boşsa geçerli dosyanın adından önerilir (reddedilen dosyanın adı önerilmez).
              if (f && !problem && !fields.title) setFields((v) => ({ ...v, title: f.name.replace(/\.[^.]+$/, "") }));
            }}
          />
          {file && !errors.file && (
            <p className="ui-field-hint">
              {file.name} · {formatBytes(file.size)}
            </p>
          )}
          {errors.file && (
            <p id={`${fileId}-error`} className="ui-field-error">
              {errors.file}
            </p>
          )}
        </div>
        <MaterialFields idPrefix="upload" value={fields} onChange={setFields} errors={errors} />

        {phase === "uploading" && (
          <div className="upload-progress">
            <progress max={1} value={progress} aria-label="Dosya yükleniyor" />
            <span className="mono-num" aria-live="polite">
              %{Math.round(progress * 100)}
            </span>
          </div>
        )}
        <div className="ui-actions">
          <Button
            type="submit"
            loading={busy}
            loadingText={
              phase === "creating" ? "Hazırlanıyor…" : phase === "uploading" ? "Yükleniyor…" : "Doğrulanıyor…"
            }
          >
            Yükle ve yayınla
          </Button>
          {phase === "uploading" && (
            <Button variant="secondary" onClick={() => cancelRef.current?.()}>
              Yüklemeyi iptal et
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
