import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore, type Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { auditIn, writeAuditLog } from "./auditLogger";
import { defineCallable } from "./callable";
import { MATERIAL_UPLOAD, type MaterialFileType } from "./shared/constants";
import { AUDIENCE_REQUIRED_MESSAGE, hasAudience } from "./shared/materials";
import { COLLECTIONS, type MaterialDoc } from "./shared/types";

/**
 * MODÜL 1 — EĞİTİM MATERYALLERİ (sunucu, F6.1; AUDIT C11)
 *
 *   createMaterial ──▶ draft (yükleme yolu döner) ──istemci Storage'a yükler──▶ finalizeMaterialUpload ──▶ published
 *
 *  - Doküman yalnızca burada yazılır (kurallar istemci yazımını kapatır). `uploadedBy` ve `uploadedByName`
 *    istemciden değil, admin profilinden gelir.
 *  - Yayın, dosya Storage'da GERÇEKTEN varsa ve türü/boyutu izinliyse yapılır (Storage metadata'sı; istemcinin
 *    beyanına güvenilmez). Taslak hekime görünmez.
 *  - Silme: Storage'daki dosya(lar), bütün okuma ilerlemeleri (`progress`) ve doküman.
 *  - Her işlem denetim kaydı yazar.
 */

const materials = () => getFirestore().collection(COLLECTIONS.materials);
type Material = MaterialDoc<Timestamp>;

const EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const TR_ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Storage nesne adı: ASCII, tireli, uzantı içerik türünden (dosya adındaki uzantıya güvenilmez). */
export function safeObjectName(fileName: string, contentType: string): string {
  const base =
    fileName
      .replace(/\.[^.]+$/, "")
      .toLocaleLowerCase("tr")
      .replace(/[çğıöşüâîû]/g, (c) => TR_ASCII[c] ?? c)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "materyal";
  return `${base}.${EXTENSION[contentType] ?? "bin"}`;
}

const fileTypeOf = (contentType: string): MaterialFileType | null =>
  (MATERIAL_UPLOAD.contentTypes as Record<string, MaterialFileType>)[contentType] ?? null;

async function materialOrThrow(materialId: string) {
  const snap = await materials().doc(materialId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Materyal bulunamadı.");
  return { ref: snap.ref, data: snap.data() as Material };
}

/** Admin: taslak oluşturur ve dosyanın yükleneceği yolu döner. */
export const createMaterial = defineCallable("createMaterial", "admin", async (data, actor) => {
  const fileType = fileTypeOf(data.contentType);
  if (!fileType) throw new HttpsError("invalid-argument", "Dosya türü kabul edilmiyor.");
  const ref = materials().doc();
  const storagePath = `materials/${ref.id}/${safeObjectName(data.fileName, data.contentType)}`;
  const batch = getFirestore().batch();
  batch.set(ref, {
    title: data.title,
    description: data.description,
    labels: data.labels,
    targetYears: [...data.targetYears].sort((x, y) => x - y),
    targetSpecialists: data.targetSpecialists,
    isMandatory: data.isMandatory,
    allowDownload: data.allowDownload,
    fileType,
    storagePath,
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
    uploadedBy: actor.uid,
    uploadedByName: `${actor.profile.title ?? ""} ${actor.profile.fullName ?? ""}`.trim() || actor.email,
    status: "draft",
    createdAt: FieldValue.serverTimestamp(),
  });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "MATERIAL_DRAFT_CREATED",
    resourceType: "materials",
    resourceId: ref.id,
    metadata: {
      title: data.title,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      labelCount: data.labels.length,
    },
  });
  await batch.commit();
  return { materialId: ref.id, storagePath };
});

/**
 * Admin: yükleme bitti. Dosya Storage'da yoksa, türü beyan edilenden farklıysa ya da izinli değilse veya boyut
 * sınırı aşılıyorsa yayınlanmaz. Boyut ve tür Storage'daki gerçek değerlerle güncellenir.
 */
export const finalizeMaterialUpload = defineCallable("finalizeMaterialUpload", "admin", async (data, actor) => {
  const { ref, data: material } = await materialOrThrow(data.materialId);
  if (material.status !== "draft") throw new HttpsError("failed-precondition", "Materyal zaten yayında.");

  const file = getStorage().bucket().file(material.storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError("failed-precondition", "Dosya henüz yüklenmemiş. Yüklemeyi tamamlayıp tekrar deneyin.");
  }
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "");
  const sizeBytes = Number(metadata.size ?? 0);
  const fileType = fileTypeOf(contentType);
  if (!fileType || contentType !== material.contentType) {
    throw new HttpsError("invalid-argument", "Yüklenen dosyanın türü beyan edilenle uyuşmuyor veya kabul edilmiyor.");
  }
  if (sizeBytes <= 0 || sizeBytes > MATERIAL_UPLOAD.maxMb * 1024 * 1024) {
    throw new HttpsError("invalid-argument", `Dosya boş veya ${MATERIAL_UPLOAD.maxMb} MB sınırını aşıyor.`);
  }

  const batch = getFirestore().batch();
  batch.update(ref, {
    status: "published",
    sizeBytes,
    contentType,
    fileType,
    publishedAt: FieldValue.serverTimestamp(),
  });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "MATERIAL_PUBLISHED",
    resourceType: "materials",
    resourceId: ref.id,
    metadata: { title: material.title, sizeBytes, contentType },
  });
  await batch.commit();
  return { published: true as const, sizeBytes, fileType };
});

/** Admin: başlık, açıklama, etiketler, hedef kıdem, zorunluluk, indirme izni. Dosya değişmez. */
export const updateMaterial = defineCallable("updateMaterial", "admin", async (data, actor) => {
  const { ref, data: existing } = await materialOrThrow(data.materialId);
  const { materialId, ...fields } = data;
  // Hedef kitle birleşik denetlenir (D26): yalnızca bir alan gelse de sonuçta en az bir hedef kalmalı.
  const years = fields.targetYears ?? existing.targetYears ?? [];
  const specialists = fields.targetSpecialists ?? existing.targetSpecialists === true;
  if (!hasAudience(years, specialists)) throw new HttpsError("invalid-argument", AUDIENCE_REQUIRED_MESSAGE);
  const changes: Record<string, unknown> = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  );
  if (fields.targetYears) changes.targetYears = [...fields.targetYears].sort((x, y) => x - y);
  if (Object.keys(changes).length === 0) throw new HttpsError("invalid-argument", "Değiştirilecek alan yok.");
  const batch = getFirestore().batch();
  batch.update(ref, {
    ...changes,
    // Etiketler yazılınca F11.5 öncesi sabit kategori alanı temizlenir (tek kaynak `labels`, D25).
    ...(changes.labels !== undefined ? { category: FieldValue.delete() } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
  auditIn(batch, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "MATERIAL_UPDATED",
    resourceType: "materials",
    resourceId: materialId,
    metadata: { fields: Object.keys(changes) },
  });
  await batch.commit();
  return { updated: true as const };
});

/** Admin: Storage dosyası, okuma ilerlemeleri ve doküman silinir (taslak veya yayında). */
export const deleteMaterial = defineCallable("deleteMaterial", "admin", async (data, actor) => {
  const { ref, data: material } = await materialOrThrow(data.materialId);
  // Önce dosya: silinemezse doküman da kalır (hekim erişilemeyen bir materyal görmez).
  await getStorage()
    .bucket()
    .deleteFiles({ prefix: `materials/${ref.id}/`, force: true });
  const progress = await ref.collection(COLLECTIONS.materialProgress).count().get();
  await getFirestore().recursiveDelete(ref);
  await writeAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "MATERIAL_DELETED",
    resourceType: "materials",
    resourceId: ref.id,
    severity: "WARN",
    metadata: { title: material.title, status: material.status, progressDeleted: progress.data().count },
  });
  return { deleted: true as const, progressDeleted: progress.data().count };
});
