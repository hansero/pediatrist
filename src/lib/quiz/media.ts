"use client";

import { useEffect, useState } from "react";
import { getDownloadURL, listAll, ref, uploadBytesResumable } from "firebase/storage";
import { QUIZ_MEDIA_UPLOAD } from "@shared/constants";
import { QUIZ_IMAGE_PATH_RE } from "@shared/quizQuestion";
import { AppError, toUserMessage } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { slugify } from "@/lib/slug";

/**
 * Sınav görselleri (`quiz_media/`, F5.2). Tür ve boyut sınırları `QUIZ_MEDIA_UPLOAD` ile `storage.rules`'ta
 * aynıdır (birim testiyle denetlenir, D19). CSV'nin 2. sütunu bu yollara başvurur; sunucu taslak kaydında
 * görselin var olduğunu denetler.
 */

export const QUIZ_MEDIA_DIR = "quiz_media";

const EXTENSIONS: Record<(typeof QUIZ_MEDIA_UPLOAD.contentTypes)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Dosya adından güvenli Storage yolu: `quiz_media/<ascii-ad>.<uzantı>` (CSV'deki yol kuralına uyar). */
export function quizMediaPath(fileName: string, contentType: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  const ext = EXTENSIONS[contentType as keyof typeof EXTENSIONS] ?? "img";
  const path = `${QUIZ_MEDIA_DIR}/${slugify(base, 80).replace(/^rapor$/, "gorsel")}.${ext}`;
  if (!QUIZ_IMAGE_PATH_RE.test(path)) throw new AppError("invalid-argument", "Geçersiz görsel adı.");
  return path;
}

/** Yüklemeden önce istemci denetimi (sunucu kuralı da aynısını uygular). `null` = geçerli. */
export function quizMediaProblem(file: { type: string; size: number }): string | null {
  if (!(QUIZ_MEDIA_UPLOAD.contentTypes as readonly string[]).includes(file.type)) {
    return "Yalnızca PNG, JPEG, WebP veya GIF görsel yüklenebilir.";
  }
  if (file.size > QUIZ_MEDIA_UPLOAD.maxMb * 1024 * 1024)
    return `Görsel en fazla ${QUIZ_MEDIA_UPLOAD.maxMb} MB olabilir.`;
  if (file.size === 0) return "Dosya boş.";
  return null;
}

function storageOrThrow() {
  const storage = initPediatristFirebase()?.storage;
  if (!storage) throw new AppError("not-configured", "Sunucu bağlantısı yapılandırılmamış.");
  return storage;
}

/** Yüklü görsellerin yolları (ada göre). */
export async function listQuizMedia(): Promise<string[]> {
  const res = await listAll(ref(storageOrThrow(), QUIZ_MEDIA_DIR));
  return res.items.map((i) => i.fullPath).sort((a, b) => a.localeCompare(b, "tr"));
}

/** Görseli yükler; ilerleme 0–1 arası bildirilir. Hata Türkçe `AppError` olarak fırlar. */
export function uploadQuizMedia(file: File, path: string, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storageOrThrow(), path), file, { contentType: file.type });
    task.on(
      "state_changed",
      (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      (err) => reject(err),
      () => resolve()
    );
  });
}

export type StorageUrlState =
  | { status: "idle" | "loading"; url: null; error: "" }
  | { status: "ready"; url: string; error: "" }
  | { status: "error"; url: null; error: string };

/** Storage yolunu indirme URL'sine çözer (`<img src>` için). Yol boşsa `idle`. */
export function useStorageUrl(path: string | null | undefined): StorageUrlState {
  const [state, setState] = useState<StorageUrlState>({ status: "idle", url: null, error: "" });
  useEffect(() => {
    if (!path) {
      setState({ status: "idle", url: null, error: "" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", url: null, error: "" });
    Promise.resolve()
      .then(() => getDownloadURL(ref(storageOrThrow(), path)))
      .then(
        (url) => !cancelled && setState({ status: "ready", url, error: "" }),
        (err: unknown) => {
          if (cancelled) return;
          const notFound = (err as { code?: string })?.code === "storage/object-not-found";
          setState({ status: "error", url: null, error: notFound ? `Görsel bulunamadı: ${path}` : toUserMessage(err) });
        }
      );
    return () => {
      cancelled = true;
    };
  }, [path]);
  return state;
}
