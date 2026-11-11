import { Alert } from "@/components/ui/Alert";

/**
 * Firebase yapılandırması eksikken gösterilen sayfa (F7.5). Uygulama "demo" verisiyle açılmaz (D1, C1):
 * sahte başarı yerine neyin eksik olduğu açıkça söylenir. Yalnızca eksik değişken ADLARI gösterilir.
 * Sunucu bileşeni: istemci SDK'sı yüklenmez.
 */
export function ConfigurationError({ missing }: { missing: readonly string[] }) {
  return (
    <main className="status-page" aria-labelledby="config-error-heading">
      <h1 id="config-error-heading">Sunucu bağlantısı yapılandırılmamış</h1>
      <Alert tone="critical" title="Platform şu anda kullanılamıyor">
        Bu kurulumda Firebase bağlantı ayarları eksik olduğu için giriş yapılamaz ve hiçbir veri gösterilemez. Platform
        yöneticisine bildirin.
      </Alert>
      <section aria-labelledby="config-missing-heading" className="auth-stack">
        <h2 id="config-missing-heading">Yönetici için: eksik ortam değişkenleri</h2>
        <ul className="config-missing">
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p className="page-header-subtitle">
          Değerleri dağıtım ortamında (ör. <code>.env.local</code>) tanımlayıp uygulamayı yeniden derleyin. Ayrıntılar:{" "}
          <code>.env.example</code>.
        </p>
      </section>
    </main>
  );
}
