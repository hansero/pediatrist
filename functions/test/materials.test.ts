import { readFileSync } from "node:fs";
import * as path from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createMaterial,
  deleteMaterial,
  finalizeMaterialUpload,
  safeObjectName,
  updateMaterial,
} from "../src/materialsService";
import { CALLABLES } from "../src/shared/schemas";
import { asAdmin, asMember, auditActions, callableRequest, createMember, errorOf, resetEmulators } from "./helpers";

const db = () => getFirestore();
const bucket = () => getStorage().bucket();
const PDF = readFileSync(path.join(process.cwd(), "scripts", "fixtures", "files", "septik-sok-ilk-saat.pdf"));

const base = {
  title: "Kawasaki Hastalığı Özeti",
  description: "Tanı ve tedavi algoritması",
  labels: ["Çocuk Enfeksiyon", " Kawasaki  "],
  targetYears: [3, 1],
  isMandatory: true,
  allowDownload: false,
  fileName: "Kawasaki Özet (2026).PDF",
  contentType: "application/pdf",
  sizeBytes: PDF.byteLength,
};

const create = async (extra: Record<string, unknown> = {}, actor = asAdmin()) =>
  CALLABLES.createMaterial.response.parse(await createMaterial.run(callableRequest({ ...base, ...extra }, actor)));
const finalize = async (materialId: string) =>
  CALLABLES.finalizeMaterialUpload.response.parse(
    await finalizeMaterialUpload.run(callableRequest({ materialId }, asAdmin()))
  );
const upload = (storagePath: string, data: Buffer, contentType: string) =>
  bucket().file(storagePath).save(data, { contentType, resumable: false });
const doc = async (id: string) => (await db().doc(`materials/${id}`).get()).data();

beforeEach(async () => {
  await resetEmulators();
  await createMember("admin", "admin", "active");
  await createMember("r1", "user", "active");
});

describe("materyal yükleme akışı (F6.1)", () => {
  it("taslak → dosya yükle → yayın; yükleyen profilden gelir, boyut/tür Storage'dan doğrulanır", async () => {
    const { materialId, storagePath } = await create();
    expect(storagePath).toBe(`materials/${materialId}/kawasaki-ozet-2026.pdf`);
    expect(await doc(materialId)).toMatchObject({
      status: "draft",
      fileType: "pdf",
      targetYears: [1, 3],
      labels: ["Çocuk Enfeksiyon", "Kawasaki"],
      uploadedBy: "admin",
      uploadedByName: "Prof. Dr. Test admin",
    });

    expect((await errorOf(finalize(materialId))).code).toBe("failed-precondition"); // dosya yok
    await upload(storagePath, PDF, "application/pdf");
    expect(await finalize(materialId)).toEqual({ published: true, sizeBytes: PDF.byteLength, fileType: "pdf" });
    expect(await doc(materialId)).toMatchObject({ status: "published", sizeBytes: PDF.byteLength });
    expect((await errorOf(finalize(materialId))).message).toBe("Materyal zaten yayında.");
    expect(await auditActions()).toEqual(expect.arrayContaining(["MATERIAL_DRAFT_CREATED", "MATERIAL_PUBLISHED"]));
  });

  it("yüklenen dosyanın türü beyan edilenden farklıysa yayınlanmaz", async () => {
    const { materialId, storagePath } = await create();
    await upload(storagePath, Buffer.from("not a pdf"), "image/png");
    const err = await errorOf(finalize(materialId));
    expect(err.code).toBe("invalid-argument");
    expect((await doc(materialId))?.status).toBe("draft");
  });

  it("izinsiz tür (pptx, SVG), boyut sınırı ve geçersiz kıdem reddedilir; hekim materyal oluşturamaz", async () => {
    const pptx = await errorOf(
      create({ contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })
    );
    expect(pptx.code).toBe("invalid-argument");
    expect(pptx.message).toContain("Sunumları PDF olarak yükleyin");
    expect((await errorOf(create({ contentType: "image/svg+xml" }))).code).toBe("invalid-argument");
    expect((await errorOf(create({ sizeBytes: 151 * 1024 * 1024 }))).message).toContain("150 MB");
    expect((await errorOf(create({ targetYears: [] }))).message).toContain("En az bir hedef kıdem");
    expect((await errorOf(create({ targetYears: [5] }))).code).toBe("invalid-argument");
    expect((await errorOf(create({ labels: Array.from({ length: 9 }, (_, i) => `E${i}`) }))).message).toContain(
      "en fazla 8 etiket"
    );
    expect((await errorOf(create({ labels: ["x".repeat(41)] }))).message).toContain("40 karakter");
    expect((await errorOf(create({}, asMember("r1")))).code).toBe("permission-denied");
    expect((await db().collection("materials").get()).size).toBe(0);
  });

  it("etiketler serbesttir: boş liste kabul, tekrarlar tek, eski kategori alanı etiket güncellenince silinir (D25)", async () => {
    const { materialId } = await create({ labels: [] });
    expect((await doc(materialId))?.labels).toEqual([]);
    // F11.5 öncesi doküman: sabit kategori alanı.
    await db().doc(`materials/${materialId}`).update({ category: "Neonatoloji (Yenidoğan)" });
    await updateMaterial.run(callableRequest({ materialId, title: "Yalnızca başlık" }, asAdmin()));
    expect(await doc(materialId)).toMatchObject({ category: "Neonatoloji (Yenidoğan)" });
    await updateMaterial.run(
      callableRequest({ materialId, labels: ["Neonatoloji", "neonatoloji", "İnfeksiyon"] }, asAdmin())
    );
    const after = await doc(materialId);
    expect(after?.labels).toEqual(["Neonatoloji", "İnfeksiyon"]);
    expect(after).not.toHaveProperty("category");
  });

  it("güncelleme yalnızca meta verileri değiştirir; olmayan materyal bulunamadı; boş güncelleme reddedilir", async () => {
    const { materialId, storagePath } = await create();
    await updateMaterial.run(
      callableRequest({ materialId, title: "Yeni başlık", targetYears: [4, 2], allowDownload: true }, asAdmin())
    );
    expect(await doc(materialId)).toMatchObject({
      title: "Yeni başlık",
      targetYears: [2, 4],
      allowDownload: true,
      storagePath,
      isMandatory: true,
    });
    expect(
      (await errorOf(updateMaterial.run(callableRequest({ materialId: "yok", title: "x" }, asAdmin())))).code
    ).toBe("not-found");
    expect((await errorOf(updateMaterial.run(callableRequest({ materialId }, asAdmin())))).code).toBe(
      "invalid-argument"
    );
    expect(await auditActions()).toContain("MATERIAL_UPDATED");
  });

  it("silme: Storage dosyası, bütün okuma ilerlemeleri ve doküman gider; denetim kaydı düşer", async () => {
    const { materialId, storagePath } = await create();
    await upload(storagePath, PDF, "application/pdf");
    await finalize(materialId);
    for (const uid of ["r1", "r2"]) {
      await db()
        .doc(`materials/${materialId}/progress/${uid}`)
        .set({ uid, secondsSpent: 10, lastPage: 1, completed: false });
    }
    const res = await deleteMaterial.run(callableRequest({ materialId }, asAdmin()));
    expect(CALLABLES.deleteMaterial.response.parse(res)).toEqual({ deleted: true, progressDeleted: 2 });
    expect(await doc(materialId)).toBeUndefined();
    expect((await db().collection(`materials/${materialId}/progress`).get()).size).toBe(0);
    expect((await bucket().file(storagePath).exists())[0]).toBe(false);
    expect(await auditActions()).toContain("MATERIAL_DELETED");
    expect((await errorOf(deleteMaterial.run(callableRequest({ materialId }, asAdmin())))).code).toBe("not-found");
  });

  it("Storage nesne adı ASCII ve uzantı içerik türünden (dosya adındaki uzantıya güvenilmez)", () => {
    expect(safeObjectName("Çocuk Acil — Şok.pdf", "application/pdf")).toBe("cocuk-acil-sok.pdf");
    expect(safeObjectName("video.exe", "video/mp4")).toBe("video.mp4");
    expect(safeObjectName("***", "image/png")).toBe("materyal.png");
  });
});
