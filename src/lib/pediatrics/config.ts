"use client";

import { collection, onSnapshot, type Timestamp } from "firebase/firestore";
import { COLLECTIONS } from "@shared/types";
import { useFirestoreSnapshot, type LiveState } from "@/hooks/useFirestoreSnapshot";
import { initPediatristFirebase } from "@/lib/firebase/client";

/** Kliniğin protokol notu (F7.4): `calculators_config/{id}`; etkin üyeler okur, yalnızca callable yazar. */
export interface CalculatorNote {
  protocolNote: string;
  updatedByName: string;
  updatedAtMs: number | null;
}

export function useCalculatorNotes(): LiveState<Map<string, CalculatorNote>> {
  return useFirestoreSnapshot<Map<string, CalculatorNote>>((onData, onError) => {
    const db = initPediatristFirebase()?.db;
    if (!db) return null;
    return onSnapshot(
      collection(db, COLLECTIONS.calculatorsConfig),
      (snap) =>
        onData(
          new Map(
            snap.docs.map((d) => {
              const v = d.data();
              const at = v.updatedAt as Timestamp | undefined;
              return [
                d.id,
                {
                  protocolNote: String(v.protocolNote ?? ""),
                  updatedByName: String(v.updatedByName ?? ""),
                  updatedAtMs: at && typeof at.toMillis === "function" ? at.toMillis() : null,
                },
              ];
            })
          )
        ),
      onError
    );
  }, []);
}
