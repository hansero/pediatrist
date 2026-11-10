/** Sayfa geçişlerinde içerik alanı (F3.2); menü ve oturum yerinde kalır. */
export default function ProtectedLoading() {
  return (
    <div className="status-page" aria-busy="true">
      <p className="page-header-subtitle" role="status">
        Sayfa yükleniyor…
      </p>
    </div>
  );
}
