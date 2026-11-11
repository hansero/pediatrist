import { expect, type Page } from "@playwright/test";
import firebaseJson from "../../firebase.json";
import { writeDocument } from "./emulator";

/**
 * Yönetim paneli (F7.1) yardımcıları. Seed hesaplarını (ör. bekleyen@) bozmamak için her test kendi üyesini
 * oluşturur: Auth emülatöründe hesap + `users/{uid}` (onay bekliyor). Yalnızca emülatör.
 */
export async function createPendingMember(email: string, fullName: string): Promise<string> {
  const { auth } = firebaseJson.emulators;
  const res = await fetch(
    `http://${auth.host}:${auth.port}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Deneme-Sifre-2026", returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error(`Test üyesi oluşturulamadı (HTTP ${res.status})`);
  const { localId } = (await res.json()) as { localId: string };
  await writeDocument(`users/${localId}`, {
    uid: localId,
    title: "Asistan Dr.",
    fullName,
    email,
    residencyYear: 2,
    role: "user",
    status: "pending",
    createdAt: new Date(),
  });
  return localId;
}

/** Üyeler sekmesinde e-postası eşleşen satır (sayfa /admin değilse açılır). */
export async function memberRow(admin: Page, email: string) {
  if (!new URL(admin.url()).pathname.startsWith("/admin")) await admin.goto("/admin");
  const row = admin.getByRole("row").filter({ hasText: email });
  await expect(row).toHaveCount(1);
  return row;
}

/** Satırın "İşlemler" menüsünü açar. */
export async function openMemberMenu(admin: Page, email: string) {
  const row = await memberRow(admin, email);
  await row.getByRole("button", { name: /: işlemler$/ }).click();
  const menu = admin.getByRole("dialog", { name: "Üye işlemleri" });
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * Menüden bir işlem seçer, onay diyalogunu onaylar ve sunucu sonucunu (bildirim) bekler.
 * Onay diyalogunun başlığı işlemin adıdır; diyalog yalnızca sunucu yanıtından sonra kapanır.
 */
export async function runMemberAction(
  admin: Page,
  email: string,
  action: string,
  confirmLabel: string,
  done: string | RegExp
) {
  const menu = await openMemberMenu(admin, email);
  await menu.getByRole("button", { name: action, exact: true }).click();
  const confirm = admin.getByRole("alertdialog", { name: action });
  await confirm.getByRole("button", { name: confirmLabel, exact: true }).click();
  await expect(confirm).toHaveCount(0, { timeout: 15_000 });
  await expect(admin.getByRole("status").filter({ hasText: done })).toBeVisible();
}
