import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABEL,
  availableActions,
  filterMembers,
  sortMembers,
  toInvitationRow,
  type MemberRow,
} from "@/lib/admin/members";

const member = (uid: string, extra: Partial<MemberRow> = {}): MemberRow => ({
  uid,
  title: "Asistan Dr.",
  fullName: uid,
  email: `${uid}@x.test`,
  residencyYear: 1,
  role: "user",
  status: "active",
  createdAtMs: 1,
  ...extra,
});

describe("üye işlemleri (F7.1)", () => {
  it("onayla (bekleyen) ve yeniden etkinleştir (askıdaki) ayrı; kendi satırında rol/durum ve MFA işlemi yok", () => {
    expect(availableActions(member("p", { status: "pending" }), "me")).toEqual([
      "approve",
      "suspend",
      "resetMfa",
      "changeYear",
      "exportData",
      "delete",
    ]);
    expect(availableActions(member("s", { status: "suspended" }), "me")).toEqual([
      "reactivate",
      "resetMfa",
      "changeYear",
      "exportData",
      "delete",
    ]);
    expect(availableActions(member("a"), "me")).toEqual([
      "suspend",
      "makeAdmin",
      "resetMfa",
      "changeYear",
      "exportData",
      "delete",
    ]);
    // Kendi satırı: yalnızca kendi veri dökümü; silme yok (F9.1). Yoklama cihazı sıfırlama yok (D23).
    expect(availableActions(member("me", { role: "admin" }), "me")).toEqual(["exportData"]);
    expect(availableActions(member("b", { role: "admin" }), "me")).toEqual([
      "suspend",
      "removeAdmin",
      "resetMfa",
      "exportData",
      "delete",
    ]);
  });

  it("kıdem yılı değiştirme yalnızca asistanlarda (uzman ve öğretim üyesinde yok; D24)", () => {
    for (const title of ["Uzm. Dr.", "Doç. Dr.", "Prof. Dr."]) {
      expect(availableActions(member("u", { title, residencyYear: null }), "me")).not.toContain("changeYear");
    }
    expect(availableActions(member("r", { title: "Asistan Dr." }), "me")).toContain("changeYear");
  });

  it("sıralama: önce bekleyenler, sonra ada göre; arama ad ve e-postada, Türkçe harf duyarsız", () => {
    const rows = sortMembers([
      member("z", { fullName: "Zeynep" }),
      member("p", { fullName: "Ali", status: "pending" }),
      member("ç", { fullName: "Çağla", status: "suspended" }),
      member("c", { fullName: "Can" }),
    ]);
    expect(rows.map((r) => r.uid)).toEqual(["p", "c", "z", "ç"]);
    expect(filterMembers(rows, { status: "all", search: "ÇAĞ" }).map((r) => r.uid)).toEqual(["ç"]);
    expect(filterMembers(rows, { status: "pending", search: "" }).map((r) => r.uid)).toEqual(["p"]);
    expect(filterMembers(rows, { status: "all", search: "z@x" }).map((r) => r.uid)).toEqual(["z"]);
  });

  it("davet durumu: kullanıldı > iptal > süresi doldu > geçerli", () => {
    const ts = (v: number) => ({ toMillis: () => v });
    expect(toInvitationRow("i", { used: true, revoked: true, expiresAt: ts(1) }, 10).state).toBe("used");
    expect(toInvitationRow("i", { revoked: true, expiresAt: ts(1) }, 10).state).toBe("revoked");
    expect(toInvitationRow("i", { expiresAt: ts(5) }, 10).state).toBe("expired");
    expect(toInvitationRow("i", { expiresAt: ts(50) }, 10).state).toBe("valid");
  });
});

describe("denetim kaydı eylem adları (F7.2)", () => {
  it("sunucunun yazdığı her eylem kodunun Türkçe adı var", () => {
    const dir = path.join(process.cwd(), "functions", "src");
    const source = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    const actions = new Set<string>();
    for (const m of source.matchAll(/(?:action: |rejected\(|\? |: )"([A-Z][A-Z_]{5,})"/g)) actions.add(m[1]);
    // Bilinen eylem olmayan sabitler (ör. önem seviyeleri) eşleşmesin diye yalnızca eylem önekleri.
    const relevant = [...actions].filter((a) =>
      /^(MEMBER|INVITATION|ATTENDANCE|QUIZ|MATERIAL|CALCULATOR|RATE)_/.test(a)
    );
    expect(relevant.length).toBeGreaterThan(20);
    expect(relevant.filter((a) => !(a in AUDIT_ACTION_LABEL))).toEqual([]);
  });
});
