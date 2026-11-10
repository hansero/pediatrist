import type { Metadata } from "next";
import Link from "next/link";
import { KVKK_NOTICE_EFFECTIVE_DATE, KVKK_NOTICE_SECTIONS, KVKK_NOTICE_VERSION } from "@shared/consent";
import { Alert } from "@/components/ui/Alert";
import { kvkkController } from "@/lib/kvkk";

export const metadata: Metadata = { title: "KVKK Aydınlatma Metni — Pediatrist" };

const effectiveDate = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(
  new Date(`${KVKK_NOTICE_EFFECTIVE_DATE}T00:00:00`)
);

/** KVKK md. 10 aydınlatma metni (F3.5). Herkese açık; kayıt formundan bağlantı verilir. */
export default function KvkkNoticePage() {
  const controller = kvkkController();
  return (
    <main className="auth-screen">
      <article className="auth-card notice-card" aria-labelledby="kvkk-heading">
        <h1 id="kvkk-heading" className="auth-title">
          Kişisel Verilerin Korunması Aydınlatma Metni
        </h1>
        <p className="page-header-subtitle">
          Sürüm {KVKK_NOTICE_VERSION} · Yürürlük: {effectiveDate}
        </p>

        <section className="notice-section" aria-labelledby="kvkk-controller">
          <h2 id="kvkk-controller">Veri sorumlusu</h2>
          {controller ? (
            <p>
              6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca veri sorumlusu{" "}
              <strong>{controller.name}</strong>&apos;dır. Başvurularınızı <strong>{controller.contact}</strong>{" "}
              adresine iletebilirsiniz.
            </p>
          ) : (
            <Alert tone="critical" title="Veri sorumlusu bilgileri yapılandırılmamış">
              Bu kurulumda veri sorumlusu bilgileri tanımlanmadığı için aydınlatma metni eksiktir ve üyelik başvurusu
              alınmaz. Lütfen platform yöneticisine bildirin.
            </Alert>
          )}
        </section>

        {KVKK_NOTICE_SECTIONS.map((section, i) => (
          <section key={section.heading} className="notice-section" aria-labelledby={`kvkk-s${i}`}>
            <h2 id={`kvkk-s${i}`}>{section.heading}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <div className="auth-links">
          <Link href="/register">Üyelik başvurusuna dön</Link>
          <Link href="/login">Girişe dön</Link>
        </div>
      </article>
    </main>
  );
}
