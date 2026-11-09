import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { claimsOf, createRulesEnv, member, seedMembers } from "./helpers";

const admin = member("t-admin", "admin", "active");
const resident = member("t-res", "user", "active");
const pending = member("t-pending", "user", "pending");
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
const FILE = "materials/m1/ornek.pdf";

/** `put()` bir UploadTask (thenable) döndürür; assert* yardımcıları Promise bekler. */
const upload = (storage: ReturnType<typeof as>, filePath: string, contentType: string) =>
  Promise.resolve(storage.ref(filePath).put(PDF, { contentType }));

let env: RulesTestEnvironment;
const as = (m: ReturnType<typeof member>) => env.authenticatedContext(m.uid, claimsOf(m)).storage();

beforeAll(async () => {
  env = await createRulesEnv();
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearStorage();
  await seedMembers(env, [admin, resident, pending]);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref(FILE).put(PDF, { contentType: "application/pdf" });
  });
});

describe("materyal dosyaları", () => {
  it("aktif üye okuyabilir; bekleyen ve oturumsuz kullanıcı okuyamaz", async () => {
    await assertSucceeds(as(resident).ref(FILE).getMetadata());
    await assertFails(as(pending).ref(FILE).getMetadata());
    await assertFails(env.unauthenticatedContext().storage().ref(FILE).getMetadata());
  });

  it("asistan dosya yükleyemez; admin PDF yükleyebilir", async () => {
    await assertFails(upload(as(resident), "materials/m2/x.pdf", "application/pdf"));
    await assertSucceeds(upload(as(admin), "materials/m2/x.pdf", "application/pdf"));
  });

  it("admin izin verilmeyen türde dosya yükleyemez", async () => {
    await assertFails(upload(as(admin), "materials/m2/x.exe", "application/x-msdownload"));
  });

  it.fails("C11 (F2.2): admin materyal dosyasını silebilir", async () => {
    await assertSucceeds(as(admin).ref(FILE).delete());
  });
});
