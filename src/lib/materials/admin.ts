"use client";

import { collection, limit, onSnapshot, orderBy, query, type DocumentData, type Timestamp } from "firebase/firestore";
import { ref, uploadBytesResumable } from "firebase/storage";
import { MATERIAL_UPLOAD, type MaterialFileType } from "@shared/constants";
import { COLLECTIONS, type MaterialStatus } from "@shared/types";
import { useCapped, useFirestoreSnapshot, type CappedState, type LiveState } from "@/hooks/useFirestoreSnapshot";
import type { MemberSummary } from "@/lib/attendance/live";
import type { CsvCell } from "@/lib/csv";
import { AppError, notConfiguredError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { slugify } from "@/lib/slug";

/**
 * Admin materyal yönetimi verisi (F6.2). Yazmalar callable'larda (`createMaterial`, `finalizeMaterialUpload`,
 * `updateMaterial`, `deleteMaterial`); dosya istemciden Storage'a yüklenir (kural: admin, tür, boyut).
 */

const ms = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp).toMillis() : null;

export interface MaterialView {
  id: string;
  title: string;
  description: string;
  category: string;
  targetYears: number[];
  isMandatory: boolean;
  allowDownload: boolean;
  fileType: MaterialFileType;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string;
  status: MaterialStatus;
  createdAtMs: number | null;
  publishedAtMs: number | null;
}

export function toMaterialView(id: string, d: DocumentData): MaterialView {
  return {
    id,
    title: String(d.title ?? ""),
    description: String(d.description ?? ""),
    category: String(d.category ?? ""),
    targetYears: Array.isArray(d.targetYears) ? d.targetYears.map(Number).sort() : [],
    isMandatory: d.isMandatory === true,
    allowDownload: d.allowDownload === true,
    fileType: d.fileType === "video" || d.fileType === "image" ? d.fileType : "pdf",
    storagePath: String(d.storagePath ?? ""),
    contentType: String(d.contentType ?? ""),
    sizeBytes: Number(d.sizeBytes ?? 0),
    uploadedByName: String(d.uploadedByName ?? ""),
    status: d.status === "published" ? "published" : "draft",
    createdAtMs: ms(d.createdAt),
    publishedAtMs: ms(d.publishedAt),
  };
}

export const FILE_TYPE_LABEL: Record<MaterialFileType, string> = { pdf: "PDF", video: "Video", image: "Görsel" };

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

export const yearsLabel = (years: readonly number[]) => (years.length ? years.map((y) => `${y}. yıl`).join(", ") : "—");

/** Admin: bütün materyaller (taslak dahil), yeniden eskiye. */
export function useMaterials(count = 200): CappedState<MaterialView> {
  const state = useFirestoreSnapshot<MaterialView[]>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      const q = query(collection(db, COLLECTIONS.materials), orderBy("createdAt", "desc"), limit(count + 1));
      return onSnapshot(q, (snap) => onData(snap.docs.map((d) => toMaterialView(d.id, d.data()))), onError);
    },
    [count]
  );
  return useCapped(state, count);
}

// --- Yükleme ---------------------------------------------------------------------------------------

/** İstemci denetimi (sunucu ve Storage kuralı aynısını uygular). `null` = geçerli. */
export function materialFileProblem(file: { type: string; size: number }): string | null {
  if (!(file.type in MATERIAL_UPLOAD.contentTypes)) {
    return "Yalnızca PDF, video (MP4/WebM/MOV) veya görsel (PNG/JPEG/WebP) yüklenebilir. Sunumları PDF olarak kaydedip yükleyin.";
  }
  if (file.size === 0) return "Dosya boş.";
  if (file.size > MATERIAL_UPLOAD.maxMb * 1024 * 1024) return `Dosya en fazla ${MATERIAL_UPLOAD.maxMb} MB olabilir.`;
  return null;
}

export interface UploadSteps {
  create: () => Promise<{ materialId: string; storagePath: string }>;
  upload: (storagePath: string) => Promise<void>;
  finalize: (materialId: string) => Promise<unknown>;
  /** Yarım kalan taslağı temizler (iptal veya hata). */
  discard: (materialId: string) => Promise<unknown>;
}

/**
 * Yükleme akışı: taslak → dosya → sunucuda doğrulama ve yayın. Yükleme ya da doğrulama başarısız olursa (iptal
 * dahil) taslak silinir: hekime asla görünmeyen ama listede kalan "yarım" kayıt bırakılmaz. Asıl hata yeniden
 * fırlatılır; temizlik de başarısız olursa bu ayrıca bildirilir. Saf akış; adımlar enjekte edilir (birim testli).
 */
export async function runMaterialUpload(steps: UploadSteps): Promise<{ materialId: string }> {
  const { materialId, storagePath } = await steps.create();
  try {
    await steps.upload(storagePath);
    await steps.finalize(materialId);
    return { materialId };
  } catch (err) {
    try {
      await steps.discard(materialId);
    } catch {
      throw new AppError(
        "internal",
        "Yükleme tamamlanamadı ve yarım kalan taslak silinemedi. Listeden taslağı elle silin."
      );
    }
    throw err;
  }
}

export interface UploadHandle {
  promise: Promise<void>;
  cancel: () => void;
}

/** Dosyayı Storage'a yükler; ilerleme 0–1. `cancel` yüklemeyi durdurur (Türkçe "iptal edildi" hatasıyla biter). */
export function uploadMaterialFile(file: File, storagePath: string, onProgress: (f: number) => void): UploadHandle {
  const storage = initPediatristFirebase()?.storage;
  if (!storage) throw notConfiguredError();
  const task = uploadBytesResumable(ref(storage, storagePath), file, { contentType: file.type });
  const promise = new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      reject,
      () => resolve()
    );
  });
  return { promise, cancel: () => void task.cancel() };
}

// --- Okunma raporu -----------------------------------------------------------------------------------

export interface ProgressView {
  uid: string;
  secondsSpent: number;
  lastPage: number;
  completed: boolean;
  updatedAtMs: number | null;
}

export function toProgressView(d: DocumentData): ProgressView {
  return {
    uid: String(d.uid ?? ""),
    secondsSpent: Number(d.secondsSpent ?? 0),
    lastPage: Number(d.lastPage ?? 0),
    completed: d.completed === true,
    updatedAtMs: ms(d.updatedAt),
  };
}

/** Materyalin okuma ilerlemeleri (admin okur), canlı. */
export function useMaterialProgress(materialId: string | null): LiveState<ProgressView[]> {
  return useFirestoreSnapshot<ProgressView[]>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      if (!materialId) {
        onData([]);
        return () => {};
      }
      return onSnapshot(
        collection(db, COLLECTIONS.materials, materialId, COLLECTIONS.materialProgress),
        (snap) => onData(snap.docs.map((d) => toProgressView(d.data()))),
        onError
      );
    },
    [materialId]
  );
}

export type ReadStatus = "completed" | "started" | "not_started";
export const READ_STATUS_LABEL: Record<ReadStatus, string> = {
  completed: "Tamamladı",
  started: "Başladı",
  not_started: "Başlamadı",
};

export interface ReadRow {
  uid: string;
  name: string;
  residencyYear: number | null;
  /** Hedef kitlede mi (materyalin hedef kıdeminde etkin asistan)? */
  targeted: boolean;
  status: ReadStatus;
  secondsSpent: number;
  lastPage: number;
  updatedAtMs: number | null;
}

/**
 * Okunma raporu: hedef kitle = materyalin hedef kıdemlerindeki ETKİN asistanlar. Hedef dışında olup okuyanlar
 * da (ör. başka kıdem) listede kalır ama orana katılmaz. Sıra: başlamayan, başlayan, tamamlayan; sonra ada göre.
 */
export function buildReadReport(
  material: Pick<MaterialView, "targetYears">,
  doctors: readonly MemberSummary[],
  progress: readonly ProgressView[]
): { rows: ReadRow[]; targeted: number; completed: number; started: number; notStarted: number } {
  const byUid = new Map(progress.map((p) => [p.uid, p]));
  const doctorByUid = new Map(doctors.map((d) => [d.uid, d]));
  const targetUids = doctors
    .filter((d) => d.residencyYear !== null && material.targetYears.includes(d.residencyYear))
    .map((d) => d.uid);
  const uids = [...new Set([...targetUids, ...progress.map((p) => p.uid)])];
  const targetSet = new Set(targetUids);
  const order: Record<ReadStatus, number> = { not_started: 0, started: 1, completed: 2 };
  const rows = uids
    .map((uid): ReadRow => {
      const d = doctorByUid.get(uid);
      const p = byUid.get(uid);
      return {
        uid,
        name: d ? `${d.title} ${d.fullName}`.trim() : "Etkin olmayan üye",
        residencyYear: d?.residencyYear ?? null,
        targeted: targetSet.has(uid),
        status: p?.completed ? "completed" : p ? "started" : "not_started",
        secondsSpent: p?.secondsSpent ?? 0,
        lastPage: p?.lastPage ?? 0,
        updatedAtMs: p?.updatedAtMs ?? null,
      };
    })
    .sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, "tr"));
  const targeted = rows.filter((r) => r.targeted);
  return {
    rows,
    targeted: targeted.length,
    completed: targeted.filter((r) => r.status === "completed").length,
    started: targeted.filter((r) => r.status === "started").length,
    notStarted: targeted.filter((r) => r.status === "not_started").length,
  };
}

export function readReportCsv(title: string, rows: readonly ReadRow[]) {
  return {
    fileName: `okunma-raporu-${slugify(title)}.csv`,
    headers: ["Materyal", "Hekim", "Kıdem", "Hedef kitlede", "Durum", "Süre (dk)", "Son sayfa"],
    rows: rows.map((r): CsvCell[] => [
      title,
      r.name,
      r.residencyYear ? `${r.residencyYear}. yıl` : "—",
      r.targeted ? "Evet" : "Hayır",
      READ_STATUS_LABEL[r.status],
      Math.round(r.secondsSpent / 60),
      r.lastPage || "",
    ]),
  };
}
