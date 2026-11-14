"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where, type Timestamp } from "firebase/firestore";
import { hasLabel, matchesAudience, type MaterialAudience } from "@shared/materials";
import { RESIDENCY_YEARS } from "@shared/constants";
import { COLLECTIONS } from "@shared/types";
import { useFirestoreSnapshot, type LiveState } from "@/hooks/useFirestoreSnapshot";
import { notConfiguredError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { toMaterialView, type MaterialView } from "./admin";
import { createSaveQueue } from "@/lib/saveQueue";

/**
 * Hekim materyal verisi (F6.3). Kurallar: hekim yalnızca yayındaki materyalleri (liste sorgusu
 * `status == published` içermek zorunda) ve kendi `progress/{uid}` dokümanını okur/yazar.
 */

/** Materyali doğrudan açan bağlantı parametresi (`/materials?materyal=<id>`, ana sayfadaki zorunlu materyal). */
export const MATERIAL_PARAM = "materyal";

/** Yayındaki materyaller (yeniden eskiye, istemcide sıralanır: tek alanlı filtre, ek indeks gerekmez). */
export function usePublishedMaterials(): LiveState<MaterialView[]> {
  return useFirestoreSnapshot<MaterialView[]>((onData, onError) => {
    const db = initPediatristFirebase()?.db;
    if (!db) return null;
    const q = query(collection(db, COLLECTIONS.materials), where("status", "==", "published"));
    return onSnapshot(
      q,
      (snap) =>
        onData(
          snap.docs
            .map((d) => toMaterialView(d.id, d.data()))
            .sort((a, b) => (b.publishedAtMs ?? b.createdAtMs ?? 0) - (a.publishedAtMs ?? a.createdAtMs ?? 0))
        ),
      onError
    );
  }, []);
}

export interface MyProgress {
  secondsSpent: number;
  lastPage: number;
  completed: boolean;
  updatedAtMs: number | null;
}

const EMPTY: MyProgress = { secondsSpent: 0, lastPage: 0, completed: false, updatedAtMs: null };

/** Kendi ilerlemem (yoksa sıfır). */
export function useMyProgress(materialId: string, uid: string): LiveState<MyProgress> {
  return useFirestoreSnapshot<MyProgress>(
    (onData, onError) => {
      const db = initPediatristFirebase()?.db;
      if (!db) return null;
      return onSnapshot(
        doc(db, COLLECTIONS.materials, materialId, COLLECTIONS.materialProgress, uid),
        (snap) => {
          const d = snap.data();
          onData(
            d
              ? {
                  secondsSpent: Number(d.secondsSpent ?? 0),
                  lastPage: Number(d.lastPage ?? 0),
                  completed: d.completed === true,
                  updatedAtMs: (d.updatedAt as Timestamp | undefined)?.toMillis?.() ?? null,
                }
              : EMPTY
          );
        },
        onError
      );
    },
    [materialId, uid]
  );
}

/** Kural sınırı: `secondsSpent <= 604800` (7 gün), `lastPage <= 10000`. */
export const MAX_SECONDS = 604_800;
export const MAX_PAGE = 10_000;

/**
 * Yazılacak ilerleme: süre birikir (sınıra kırpılır), son sayfa geri gitmez (en uzak okunan sayfa), tamamlandı
 * bir kez doğru olunca geri alınmaz. Saf; birim testli.
 */
export function mergeProgress(
  saved: Pick<MyProgress, "secondsSpent" | "lastPage" | "completed">,
  session: { addSeconds: number; page: number; completed: boolean }
): { secondsSpent: number; lastPage: number; completed: boolean } {
  return {
    secondsSpent: Math.min(MAX_SECONDS, Math.max(0, Math.round(saved.secondsSpent + session.addSeconds))),
    lastPage: Math.min(MAX_PAGE, Math.max(0, saved.lastPage, Math.round(session.page))),
    completed: saved.completed || session.completed,
  };
}

/** İlerlemeyi yazar (kural şeması: tam alan kümesi, `updatedAt` sunucu saati). */
export async function writeProgress(
  materialId: string,
  uid: string,
  value: { secondsSpent: number; lastPage: number; completed: boolean }
): Promise<void> {
  const db = initPediatristFirebase()?.db;
  if (!db) throw notConfiguredError();
  await setDoc(doc(db, COLLECTIONS.materials, materialId, COLLECTIONS.materialProgress, uid), {
    uid,
    secondsSpent: value.secondsSpent,
    lastPage: value.lastPage,
    completed: value.completed,
    updatedAt: serverTimestamp(),
  });
}

type ProgressValue = Pick<MyProgress, "secondsSpent" | "lastPage" | "completed">;

/**
 * İlerleme kaydedici (F13.4). Yazmalar SIRAYLA yapılır (`createSaveQueue`): her yazım değerini gönderim anında,
 * bir önceki başarılı yazımın sonucundan hesaplar. Önceden eşzamanlı iki kayıt (15 sn'lik düzenli kayıt ve
 * "Tamamlandı") aynı eski değerden hesap yapıyor, ikinci yazım ilkinin saniyelerini siliyordu.
 * Gönderilemeyen saniyeler bir sonraki kayıtta yeniden gönderilir.
 */
export function createProgressSaver(options: {
  saved: ProgressValue;
  /** Gönderim anındaki ekran durumu: en uzak sayfa ve "tamamlandı" işareti. */
  current: () => { page: number; completed: boolean };
  write: (value: ProgressValue) => Promise<void>;
}) {
  let saved = options.saved;
  let pendingSeconds = 0;
  const queue = createSaveQueue<null>(async () => {
    const { page, completed } = options.current();
    const value = mergeProgress(saved, { addSeconds: pendingSeconds, page, completed });
    const sent = pendingSeconds;
    pendingSeconds = 0;
    try {
      await options.write(value);
      saved = value;
    } catch (err) {
      pendingSeconds += sent;
      throw err;
    }
  });
  return {
    /** Görünür sekmede geçen bir saniye. */
    addSeconds(n = 1) {
      pendingSeconds += n;
    },
    /** Güncel durumu kaydeder; o ana kadarki bütün değişiklikler yazılınca çözülür. */
    flush: () => queue.push(null),
    get saved(): ProgressValue {
      return saved;
    },
  };
}

/** "Tamamlandı" işaretlenebilir mi? PDF: son sayfa görüldü; video: ≥ %90 izlendi; görsel: açıldı. */
export function canComplete(
  fileType: MaterialView["fileType"],
  state: { maxPage: number; pageCount: number; watchedFraction: number }
): boolean {
  if (fileType === "pdf") return state.pageCount > 0 && state.maxPage >= state.pageCount;
  if (fileType === "video") return state.watchedFraction >= 0.9;
  return true;
}

/** Kıdem süzgeci: yıl, "Uzman" (D26) ya da hepsi. */
export type YearFilter = MaterialAudience | "all";

/** Kıdem süzgeci seçenekleri (hekim ve admin süzgeci ortak; "Bütün kıdemler" ayrıca eklenir). */
export const AUDIENCE_OPTIONS: { value: Exclude<YearFilter, "all">; label: string }[] = [
  ...RESIDENCY_YEARS.map((y) => ({ value: y, label: `${y}. yıl` })),
  { value: "specialist", label: "Uzman" },
];

/** `<select>` değerinden süzgece. */
export function parseYearFilter(raw: string): YearFilter {
  if (raw === "all" || raw === "specialist") return raw;
  const year = Number(raw);
  return (RESIDENCY_YEARS as readonly number[]).includes(year) ? year : "all";
}

/** Hekim süzgeci: kıdem/kitle ve etiket (`label`: `"all"` ya da `labelKey`). */
export function filterMaterials(
  list: readonly MaterialView[],
  { year, label }: { year: YearFilter; label: string }
): MaterialView[] {
  return list.filter((m) => matchesAudience(m, year) && hasLabel(m, label));
}
