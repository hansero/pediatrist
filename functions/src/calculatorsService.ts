import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { auditIn } from "./auditLogger";
import { defineCallable } from "./callable";
import { COLLECTIONS } from "./shared/types";

/**
 * Hesaplayıcı protokol notları (F7.4, D8). Formül motoru bu revizyonda yok; admin her planlanan hesaplayıcı
 * için kliniğin protokol notunu (serbest metin) kaydeder. Kurallar istemci yazımını kapalı tutar: yalnızca bu
 * callable yazar ve aynı batch'te denetim kaydı düşer. Boş not dokümanı siler.
 */
export const updateCalculatorConfig = defineCallable("updateCalculatorConfig", "admin", async (data, actor) => {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.calculatorsConfig).doc(data.calculatorId);
  const cleared = data.protocolNote === "";
  const batch = db.batch();
  if (cleared) {
    batch.delete(ref);
  } else {
    batch.set(ref, {
      calculatorId: data.calculatorId,
      protocolNote: data.protocolNote,
      updatedBy: actor.uid,
      updatedByName: `${actor.profile.title ?? ""} ${actor.profile.fullName ?? ""}`.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: cleared ? "CALCULATOR_NOTE_CLEARED" : "CALCULATOR_NOTE_UPDATED",
    resourceType: "calculators",
    resourceId: data.calculatorId,
    metadata: { length: data.protocolNote.length },
  });
  await batch.commit();
  return { saved: true as const, cleared };
});
