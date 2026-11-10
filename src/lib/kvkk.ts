/**
 * KVKK veri sorumlusu bilgileri (F3.5). Kuruma özeldir; kodda değil ortam yapılandırmasındadır
 * (`NEXT_PUBLIC_KVKK_CONTROLLER_NAME`, `NEXT_PUBLIC_KVKK_CONTACT`). Yapılandırılmamışsa aydınlatma
 * yükümlülüğü yerine getirilemeyeceği için kayıt alınmaz.
 */
export interface KvkkController {
  name: string;
  contact: string;
}

export function kvkkController(
  name: string | undefined = process.env.NEXT_PUBLIC_KVKK_CONTROLLER_NAME,
  contact: string | undefined = process.env.NEXT_PUBLIC_KVKK_CONTACT
): KvkkController | null {
  const n = name?.trim();
  const c = contact?.trim();
  return n && c ? { name: n, contact: c } : null;
}
