import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { claimsOf, createRulesEnv, member, seedMembers } from "./helpers";

/**
 * Storage güvenlik kuralları (F2.2). Yetki Firestore'daki `users/{uid}` dokümanından
 * `firestore.get` ile okunur; token claim'leri bilerek dokümanla çelişecek şekilde verilir.
 */
const admin = member("t-admin", "admin", "active");
const resident = member("t-res", "user", "active");
const pending = member("t-pending", "user", "pending");

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
const FILE = "materials/m1/ornek.pdf";
const IMAGE = "quiz_media/ornek.png";

let env: RulesTestEnvironment;
const as = (m: ReturnType<typeof member>, extra: Record<string, unknown> = {}) =>
  env.authenticatedContext(m.uid, { ...claimsOf(m), ...extra }).storage();

/** `put()` bir UploadTask (thenable) döndürür; assert* yardımcıları Promise bekler. */
const upload = (storage: ReturnType<typeof as>, filePath: string, contentType: string, data: Uint8Array = PDF) =>
  Promise.resolve(storage.ref(filePath).put(data, { contentType }));

beforeAll(async () => {
  env = await createRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearStorage();
  await env.clearFirestore();
  await seedMembers(env, [admin, resident, pending]);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref(FILE).put(PDF, { contentType: "application/pdf" });
    await ctx.storage().ref(IMAGE).put(PDF, { contentType: "image/png" });
  });
});

describe("okuma (yetki dokümandan)", () => {
  it("aktif üye materyal ve sınav görselini okur; bekleyen ve oturumsuz kullanıcı okuyamaz", async () => {
    await assertSucceeds(as(resident).ref(FILE).getMetadata());
    await assertSucceeds(as(resident).ref(IMAGE).getMetadata());
    await assertFails(as(pending).ref(FILE).getMetadata());
    await assertFails(as(pending).ref(IMAGE).getMetadata());
    await assertFails(env.unauthenticatedContext().storage().ref(FILE).getMetadata());
  });

  it("bekleyen kullanıcı token'ında 'active' claim olsa da okuyamaz", async () => {
    await assertFails(as(pending, { status: "active" }).ref(FILE).getMetadata());
  });

  it("C5 (Storage): askıya alınmış üye eski token'la dosya okuyamaz", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("users").doc(resident.uid).update({ status: "suspended" });
    });
    await assertFails(as(resident).ref(FILE).getMetadata());
  });

  it("tokensValidAfter'dan önce açılmış oturum okuyamaz, sonrası okur", async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedMembers(env, [resident], { tokensValidAfter: now });
    await assertFails(
      as(resident, { auth_time: now - 60 })
        .ref(FILE)
        .getMetadata()
    );
    await assertSucceeds(
      as(resident, { auth_time: now + 5 })
        .ref(FILE)
        .getMetadata()
    );
  });
});

describe("materyal yükleme ve silme", () => {
  it("admin PDF, video ve görsel yükleyebilir; asistan yükleyemez", async () => {
    await assertSucceeds(upload(as(admin), "materials/m2/x.pdf", "application/pdf"));
    await assertSucceeds(upload(as(admin), "materials/m2/x.mp4", "video/mp4"));
    await assertSucceeds(upload(as(admin), "materials/m2/x.png", "image/png"));
    await assertFails(upload(as(resident), "materials/m2/x.pdf", "application/pdf"));
  });

  it("claim'de admin yazan ama dokümanda 'user' olan kullanıcı yükleyemez", async () => {
    await assertFails(upload(as(resident, { role: "admin" }), "materials/m2/x.pdf", "application/pdf"));
  });

  it("izin verilmeyen türler reddedilir: çalıştırılabilir, SVG, pptx (D19: sunumlar PDF)", async () => {
    await assertFails(upload(as(admin), "materials/m2/x.exe", "application/x-msdownload"));
    await assertFails(upload(as(admin), "materials/m2/x.svg", "image/svg+xml"));
    await assertFails(
      upload(
        as(admin),
        "materials/m2/x.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
    );
  });

  it("C11: admin materyal dosyasını silebilir; asistan silemez", async () => {
    await assertFails(as(resident).ref(FILE).delete());
    await assertSucceeds(as(admin).ref(FILE).delete());
  });

  it("materyal klasörü dışında (iç içe yol) yazılamaz", async () => {
    await assertFails(upload(as(admin), "materials/m2/alt/x.pdf", "application/pdf"));
  });
});

describe("sınav görselleri", () => {
  it("admin görsel yükler ve siler; SVG ve PDF kabul edilmez", async () => {
    await assertSucceeds(upload(as(admin), "quiz_media/yeni.webp", "image/webp"));
    await assertFails(upload(as(admin), "quiz_media/yeni.svg", "image/svg+xml"));
    await assertFails(upload(as(admin), "quiz_media/yeni.pdf", "application/pdf"));
    await assertSucceeds(as(admin).ref(IMAGE).delete());
  });

  it("15 MB ve üzeri görsel reddedilir", async () => {
    const big = new Uint8Array(15 * 1024 * 1024);
    await assertFails(upload(as(admin), "quiz_media/buyuk.png", "image/png", big));
  });

  it("asistan sınav görseli yükleyemez ve silemez", async () => {
    await assertFails(upload(as(resident), "quiz_media/x.png", "image/png"));
    await assertFails(as(resident).ref(IMAGE).delete());
  });
});

describe("tanımsız yollar", () => {
  it("listelenmeyen yollara admin bile yazamaz ve okuyamaz", async () => {
    await assertFails(upload(as(admin), "users/t-res/avatar.png", "image/png"));
    await assertFails(as(admin).ref("baska/x.pdf").getMetadata());
  });
});
