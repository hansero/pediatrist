"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where, type Timestamp } from "firebase/firestore";
import { COLLECTIONS } from "@shared/types";
import { useFirestoreSnapshot, type LiveState } from "@/hooks/useFirestoreSnapshot";
import { notConfiguredError } from "@/lib/errors";
import { initPediatristFirebase } from "@/lib/firebase/client";
import { toMaterialView, type MaterialView } from "./admin";

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

/** "Tamamlandı" işaretlenebilir mi? PDF: son sayfa görüldü; video: ≥ %90 izlendi; görsel: açıldı. */
export function canComplete(
  fileType: MaterialView["fileType"],
  state: { maxPage: number; pageCount: number; watchedFraction: number }
): boolean {
  if (fileType === "pdf") return state.pageCount > 0 && state.maxPage >= state.pageCount;
  if (fileType === "video") return state.watchedFraction >= 0.9;
  return true;
}

export type YearFilter = number | "all";

export function filterMaterials(
  list: readonly MaterialView[],
  { year, category }: { year: YearFilter; category: string }
): MaterialView[] {
  return list.filter(
    (m) => (year === "all" || m.targetYears.includes(year)) && (category === "all" || m.category === category)
  );
}
