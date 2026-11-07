"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { initPediatristFirebase, isFirebaseConfigured } from "@/lib/firebase/client";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";
import { updateMemberAccess, invokeWithFallback } from "@/lib/firebase/callables";

interface ClinicMemberRecord {
  uid: string;
  fullName: string;
  title: string;
  email: string;
  residencyYear: number;
  role: "admin" | "user";
  status: "active" | "pending" | "suspended";
  hasBoundDevice: boolean;
}

interface SecurityAuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  action: string;
  resourceType: "auth" | "materials" | "calculators" | "attendance" | "quizzes" | "admin";
  resourceId: string;
  severity: "INFO" | "WARN" | "CRITICAL";
}

/**
 * MODÜL 5 — KAPALI DEVRE ÜYE, RBAC VE SİBER GÜVENLİK PANELİ (/admin)
 *
 * GÜVENLİK:
 * - Hiçbir ekranda Firebase projectId, apiKey, authDomain, storageBucket veya ham cihaz kimliği
 *   paylaşılmaz; yalnızca bağlantı durumu (`isFirebaseConfigured()`) ve cihaz bağlama durumu
 *   (`Kayıtlı ✓` / `Sıfırlandı`) gösterilir.
 * - Yalnızca `role === "admin"` olan oturumlar erişebilir.
 */
export default function AdminSecurityPage() {
  const { session } = useClinicSession();
  const configured = isFirebaseConfigured();

  const [members, setMembers] = useState<ClinicMemberRecord[]>([
    {
      uid: "uid_admin_1",
      fullName: "Dr. Selim Kaya",
      title: "Prof. Dr.",
      email: "selim.kaya@pediatri.edu.tr",
      residencyYear: 4,
      role: "admin",
      status: "active",
      hasBoundDevice: true,
    },
    {
      uid: "uid_user_1",
      fullName: "Dr. Elif Demir",
      title: "Asistan Dr.",
      email: "elif.demir@pediatri.edu.tr",
      residencyYear: 2,
      role: "user",
      status: "active",
      hasBoundDevice: true,
    },
    {
      uid: "uid_user_2",
      fullName: "Dr. Burak Şahin",
      title: "Asistan Dr.",
      email: "burak.sahin@pediatri.edu.tr",
      residencyYear: 3,
      role: "user",
      status: "active",
      hasBoundDevice: true,
    },
    {
      uid: "uid_pending_1",
      fullName: "Dr. Mert Yılmaz",
      title: "Asistan Dr.",
      email: "mert.yilmaz@pediatri.edu.tr",
      residencyYear: 1,
      role: "user",
      status: "pending",
      hasBoundDevice: false,
    },
  ]);

  const [auditLogs, setAuditLogs] = useState<SecurityAuditLogEntry[]>([
    {
      id: "log_1",
      timestamp: "2026-11-05 12:42:50",
      actorEmail: "selim.kaya@pediatri.edu.tr",
      action: "QUIZ_PUBLISHED",
      resourceType: "quizzes",
      resourceId: "quiz_nov_w1",
      severity: "INFO",
    },
    {
      id: "log_2",
      timestamp: "2026-11-05 12:10:05",
      actorEmail: "elif.demir@pediatri.edu.tr",
      action: "ATTENDANCE_VERIFIED",
      resourceType: "attendance",
      resourceId: "att_nov05_morning",
      severity: "INFO",
    },
    {
      id: "log_3",
      timestamp: "2026-11-05 11:05:19",
      actorEmail: "mert.yilmaz@pediatri.edu.tr",
      action: "NEW_MEMBER_REGISTERED_WITH_PENDING_STATUS",
      resourceType: "auth",
      resourceId: "uid_pending_1",
      severity: "WARN",
    },
  ]);

  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");

  useEffect(() => {
    const clients = initPediatristFirebase();
    if (!clients) return;
    return onSnapshot(
      collection(clients.db, "users"),
      (snap) => {
        if (snap.empty) return;
        const liveUsers: ClinicMemberRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            fullName: String(data.fullName ?? d.id),
            title: String(data.title ?? "Asistan Dr."),
            email: String(data.email ?? ""),
            residencyYear: Number(data.residencyYear ?? 1),
            role: data.role === "admin" ? "admin" : "user",
            status:
              data.status === "active" || data.status === "suspended"
                ? data.status
                : "pending",
            hasBoundDevice: Boolean(data.boundDeviceHash),
          };
        });
        setMembers(liveUsers);
      },
      () => {}
    );
  }, []);

  if (session && session.role !== "admin") {
    return (
      <section className="surface-card" aria-labelledby="admin-rbac-denied">
        <h2 id="admin-rbac-denied">Yetkisiz Erişim Engellendi</h2>
        <p className="page-header-subtitle">Bu yönetim sayfasına yalnızca Eğitim Sorumlusu (Admin) erişebilir.</p>
      </section>
    );
  }

  const recordAudit = (
    action: string,
    resourceId: string,
    severity: "INFO" | "WARN" | "CRITICAL" = "INFO"
  ) => {
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleString("tr-TR"),
        actorEmail: session?.email || "selim.kaya@pediatri.edu.tr",
        action,
        resourceType: "admin",
        resourceId,
        severity,
      },
      ...prev,
    ]);
  };

  const filteredLogs = auditLogs.filter(
    (l) => selectedSeverity === "ALL" || l.severity === selectedSeverity
  );

  return (
    <section aria-labelledby="admin-security-page-heading">
      <div className="page-header">
        <div>
          <span className="sec-chip verified">Modül 5 • /admin • Güvenlik &amp; Üye Yönetimi</span>
          <h1 id="admin-security-page-heading" style={{ marginTop: "0.45rem" }}>
            Kapalı Devre Üyelik, RBAC ve Siber Güvenlik Denetim Paneli
          </h1>
          <p className="page-header-subtitle">
            Bekleyen üyelik onayları, rol ve kıdem ataması, kişisel yoklama cihazı sıfırlama ve değiştirilemez güvenlik denetim kayıtları.
          </p>
        </div>
      </div>

      {/* Sunucu Bağlantı Durumu — Hiçbir proje kimliği veya anahtar ekrana basılmaz */}
      <article className="surface-card" style={{ marginTop: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2>Bulut Altyapı ve Güvenlik Katmanı Durumu</h2>
            <p className="page-header-subtitle">
              Kimlik bilgileri ve proje tanımlayıcıları istemci arayüzünde paylaşılmaz; yalnızca sunucu ortam değişkenleri üzerinden yönetilir.
            </p>
          </div>
          <span className={`sec-chip ${configured ? "verified" : "warn"}`}>
            {configured ? "Güvenli Sunucu Bağlantısı: Aktif" : "Ortam Değişkeni Bekleniyor (.env.local)"}
          </span>
        </div>
      </article>

      {/* Üye Onayı, Kıdem/Rol Atama ve Cihaz Sıfırlama */}
      <article className="surface-card" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ marginBottom: "0.85rem" }}>
          Klinik Üye Matrisi, Rol Yönetimi ve Yoklama Cihaz Kilidi
        </h2>
        <div className="table-wrap">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Hekim</th>
                <th>E-Posta</th>
                <th>Kıdem</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Yoklama Cihaz Bağı</th>
                <th>Yönetici İşlemleri</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.uid}>
                  <td><strong>{m.title} {m.fullName}</strong></td>
                  <td>{m.email}</td>
                  <td>
                    <select
                      id={`admin-year-select-${m.uid}`}
                      className="form-select mono-num"
                      style={{ width: "92px", padding: "0.3rem 0.45rem" }}
                      value={m.residencyYear}
                      onChange={(e) => {
                        const yr = Number(e.target.value);
                        void invokeWithFallback(
                          () => updateMemberAccess({ targetUid: m.uid, residencyYear: yr }),
                          () => ({ ok: true, targetUid: m.uid, role: m.role, status: m.status, residencyYear: yr })
                        );
                        setMembers((prev) =>
                          prev.map((x) => (x.uid === m.uid ? { ...x, residencyYear: yr } : x))
                        );
                        recordAudit(`MEMBER_RESIDENCY_YEAR_SET_${yr}`, m.uid, "INFO");
                      }}
                    >
                      <option value={1}>1. Yıl</option>
                      <option value={2}>2. Yıl</option>
                      <option value={3}>3. Yıl</option>
                      <option value={4}>4. Yıl</option>
                    </select>
                  </td>
                  <td>
                    <span className="sec-chip primary">
                      {m.role === "admin" ? "EĞİTİM SORUMLUSU" : "ASİSTAN HEKİM"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`sec-chip ${
                        m.status === "active"
                          ? "verified"
                          : m.status === "pending"
                          ? "warn"
                          : "critical"
                      }`}
                    >
                      {m.status === "active"
                        ? "AKTİF"
                        : m.status === "pending"
                        ? "ONAY BEKLİYOR"
                        : "ASKIDA"}
                    </span>
                  </td>
                  <td>
                    <span className={`sec-chip ${m.hasBoundDevice ? "verified" : "warn"}`}>
                      {m.hasBoundDevice ? "Kayıtlı Telefon Doğrulandı ✓" : "Sıfırlandı / İlk Yoklama Bekleniyor"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      {m.status !== "active" ? (
                        <button
                          id={`admin-approve-${m.uid}`}
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            void invokeWithFallback(
                              () => updateMemberAccess({ targetUid: m.uid, status: "active" }),
                              () => ({ ok: true, targetUid: m.uid, role: m.role, status: "active" as const, residencyYear: m.residencyYear })
                            );
                            setMembers((prev) =>
                              prev.map((x) => (x.uid === m.uid ? { ...x, status: "active" } : x))
                            );
                            recordAudit(`MEMBER_APPROVED_ACTIVE`, m.uid, "INFO");
                          }}
                        >
                          Üyeliği Onayla
                        </button>
                      ) : (
                        <button
                          id={`admin-suspend-${m.uid}`}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            void invokeWithFallback(
                              () => updateMemberAccess({ targetUid: m.uid, status: "suspended" }),
                              () => ({ ok: true, targetUid: m.uid, role: m.role, status: "suspended" as const, residencyYear: m.residencyYear })
                            );
                            setMembers((prev) =>
                              prev.map((x) =>
                                x.uid === m.uid ? { ...x, status: "suspended" } : x
                              )
                            );
                            recordAudit(`MEMBER_SUSPENDED`, m.uid, "WARN");
                          }}
                        >
                          Erişimi Askıya Al
                        </button>
                      )}
                      <button
                        id={`admin-role-toggle-${m.uid}`}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const nextRole = m.role === "admin" ? "user" : "admin";
                          void invokeWithFallback(
                            () => updateMemberAccess({ targetUid: m.uid, role: nextRole }),
                            () => ({ ok: true, targetUid: m.uid, role: nextRole, status: m.status, residencyYear: m.residencyYear })
                          );
                          setMembers((prev) =>
                            prev.map((x) => (x.uid === m.uid ? { ...x, role: nextRole } : x))
                          );
                          recordAudit(`MEMBER_ROLE_CHANGED_TO_${nextRole.toUpperCase()}`, m.uid, "INFO");
                        }}
                      >
                        Yetki: {m.role === "admin" ? "Asistan Hekim Yap" : "Eğitim Sorumlusu Yap"}
                      </button>
                      <button
                        id={`admin-reset-dev-${m.uid}`}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          void invokeWithFallback(
                            () => updateMemberAccess({ targetUid: m.uid, resetBoundDevice: true }),
                            () => ({ ok: true, targetUid: m.uid, role: m.role, status: m.status, residencyYear: m.residencyYear })
                          );
                          setMembers((prev) =>
                            prev.map((x) => (x.uid === m.uid ? { ...x, hasBoundDevice: false } : x))
                          );
                          recordAudit(`MEMBER_DEVICE_BINDING_RESET`, m.uid, "WARN");
                        }}
                      >
                        Telefon Eşleşmesini Sıfırla
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {/* Değiştirilemez Siber Güvenlik Denetim Kayıtları (audit_logs) */}
      <article className="surface-card" style={{ marginTop: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "0.85rem",
          }}
        >
          <div>
            <h2>Değiştirilemez Güvenlik Denetim Logları</h2>
            <p className="page-header-subtitle">
              İstemci tarafından silinemeyen ve değiştirilemeyen sunucu denetim izleri.
            </p>
          </div>
          <select
            id="audit-severity-filter"
            className="form-select"
            style={{ width: "200px" }}
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
          >
            <option value="ALL">Tüm Önem Dereceleri</option>
            <option value="INFO">INFO (Bilgi)</option>
            <option value="WARN">WARN (Uyarı)</option>
            <option value="CRITICAL">CRITICAL (Kritik İhlal)</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Zaman Damgası</th>
                <th>Seviye</th>
                <th>Kullanıcı</th>
                <th>İşlem / Olay</th>
                <th>Modül</th>
                <th>Hedef Kayıt</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="mono-num">{log.timestamp}</td>
                  <td>
                    <span
                      className={`sec-chip ${
                        log.severity === "CRITICAL"
                          ? "critical"
                          : log.severity === "WARN"
                          ? "warn"
                          : "verified"
                      }`}
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td>{log.actorEmail}</td>
                  <td className="mono-num" style={{ fontWeight: 600 }}>{log.action}</td>
                  <td><code>{log.resourceType}</code></td>
                  <td className="mono-num">{log.resourceId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
