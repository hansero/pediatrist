/**
 * Tek seferlik temizlik (F11.1, D23): yoklama cihazı (WebAuthn passkey) kaldırıldı. Bu özellik açıkken kurulmuş
 * bir projede kalan kişisel veriyi siler (KVKK veri en aza indirme):
 *  - `users/{uid}.webauthn` alanı (passkey açık anahtarı, sayaç, kayıt zamanı),
 *  - `webauthn_challenges/*` dokümanları (tek kullanımlık tören challenge'ları).
 *
 * Varsayılan KURU ÇALIŞMA: yalnızca sayıları yazar. Silmek için `--yes` verilir.
 *
 *   gcloud auth application-default login
 *   npx tsx scripts/remove-attendance-device-data.ts --project <proje-kimliği>          # kuru çalışma
 *   npx tsx scripts/remove-attendance-device-data.ts --project <proje-kimliği> --yes    # siler
 *
 * Emülatör (`demo-` önekli proje) için gerekmez: seed bu alanları hiç yazmaz.
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const projectId = args[args.indexOf("--project") + 1];
const apply = args.includes("--yes");

if (!args.includes("--project") || !projectId || projectId.startsWith("--")) {
  console.error("Kullanım: npx tsx scripts/remove-attendance-device-data.ts --project <proje-kimliği> [--yes]");
  process.exit(2);
}
if (projectId.startsWith("demo-")) {
  console.error("Emülatör projesinde temizlenecek veri yok (seed bu alanları yazmaz).");
  process.exit(2);
}

async function main() {
  initializeApp({ projectId, credential: applicationDefault() });
  const db = getFirestore();

  const withDevice = await db.collection("users").where("webauthn", "!=", null).select().get();
  const challenges = await db.collection("webauthn_challenges").select().get();

  console.log(`Proje: ${projectId}`);
  console.log(`- passkey alanı olan üye profili: ${withDevice.size}`);
  console.log(`- webauthn_challenges dokümanı: ${challenges.size}`);

  if (!apply) {
    console.log("\nKuru çalışma: hiçbir şey silinmedi. Silmek için --yes ekleyin.");
    return;
  }

  const writer = db.bulkWriter();
  for (const d of withDevice.docs) void writer.update(d.ref, { webauthn: FieldValue.delete() });
  for (const d of challenges.docs) void writer.delete(d.ref);
  await writer.close();
  console.log("\nSilindi.");
}

main().catch((err) => {
  console.error("Temizlik başarısız:", err);
  process.exit(1);
});
