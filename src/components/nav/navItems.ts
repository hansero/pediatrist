import { isAttendanceEligible, type Role } from "@shared/constants";

export interface NavItem {
  key: string;
  href: string;
  label: string;
  /** Rol bazlı etiket (ör. admin için "Sınav Yönetimi"). */
  labelFor?: Partial<Record<Role, string>>;
  adminOnly?: boolean;
  /** Ek görünürlük kuralı (ör. yoklama yalnızca admin ve 1.–4. yıl asistana, D24). */
  visible?: (member: NavMember) => boolean;
}

/** Menü kuralları için gereken oturum alanları. */
export interface NavMember {
  role: Role;
  title: string;
  residencyYear: number | null;
}

/** Korumalı alan menüsü (F3.2). Sıra ve etiketler tek yerde. */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Genel Bakış" },
  { key: "materials", href: "/materials", label: "Eğitim Materyalleri" },
  { key: "calculators", href: "/calculators", label: "Pediatri Hesaplamaları" },
  {
    key: "attendance",
    href: "/attendance",
    label: "Ders Yoklaması",
    visible: (m) => m.role === "admin" || isAttendanceEligible(m),
  },
  { key: "quizzes", href: "/quizzes", label: "Sınavlar", labelFor: { admin: "Sınav Yönetimi" } },
  { key: "admin", href: "/admin", label: "Üyeler ve Güvenlik", adminOnly: true },
];

/** Hesap güvenliği (MFA kurulumu) sayfası; MFA zorunluyken kaydı olmayan üye buraya yönlendirilir. */
export const SECURITY_PAGE = "/account/security";

export function visibleNavItems(member: NavMember): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => (!item.adminOnly || member.role === "admin") && (!item.visible || item.visible(member))
  );
}

/** Bu menü öğesi şu anki sayfa mı? (alt yollar dahil: /quizzes/abc → Sınavlar) */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
