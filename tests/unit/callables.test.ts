import { beforeEach, describe, expect, it, vi } from "vitest";

// Firebase SDK'yı taklit et: httpsCallable(functions, name)(data) → serverImpl(name, data)
const serverImpl = vi.fn<(name: string, data: unknown) => Promise<{ data: unknown }>>();
const httpsCallable = vi.fn((_functions: unknown, name: string) => (data: unknown) => serverImpl(name, data));
vi.mock("firebase/functions", () => ({ httpsCallable: (f: unknown, n: string) => httpsCallable(f, n) }));
const configured = { value: true };
vi.mock("@/lib/firebase/client", () => ({
  initPediatristFirebase: () => (configured.value ? { functions: {} } : null),
}));

const { callFunction, startLectureSession, verifyRealTimeAttendance, completeRegistration } =
  await import("@/lib/firebase/callables");
const { AppError } = await import("@/lib/errors");
const { CALLABLES } = await import("@shared/schemas");
const { KVKK_NOTICE_VERSION } = await import("@shared/consent");

beforeEach(() => {
  serverImpl.mockReset();
  httpsCallable.mockClear();
  configured.value = true;
});

describe("callFunction", () => {
  it("geçersiz isteği AĞA ÇIKMADAN Türkçe 'invalid-argument' ile reddeder", async () => {
    const err = await startLectureSession({ title: "", lecturer: "Dr. X", durationMinutes: 999 }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: "invalid-argument" });
    expect(err.message).toBe("Ders başlığı zorunludur. Yoklama süresi (dk) 1–240 arasında olmalıdır.");
    expect(httpsCallable).not.toHaveBeenCalled();
  });

  it("normalize edilmiş isteği gönderir ve doğrulanmış yanıtı döndürür", async () => {
    serverImpl.mockResolvedValue({ data: { verified: true, alreadyRecorded: false } });
    const res = await verifyRealTimeAttendance({ sessionId: " s1 ", code: " k9p4x2 " });
    expect(res).toEqual({ verified: true, alreadyRecorded: false });
    expect(serverImpl).toHaveBeenCalledWith("verifyRealTimeAttendance", { sessionId: "s1", code: "K9P4X2" });
  });

  it("şemanın ürettiği undefined alanları göndermez (SDK onları null'a çevirir ve sunucu reddeder)", async () => {
    serverImpl.mockResolvedValue({ data: { status: "pending", role: "user", alreadyRegistered: false } });
    await completeRegistration({
      title: "Asistan Dr.",
      fullName: "Ali Veli",
      residencyYear: 2,
      inviteCode: "",
      consentVersion: KVKK_NOTICE_VERSION,
    });
    const sent = serverImpl.mock.calls[0][1] as Record<string, unknown>;
    expect(sent).toEqual({
      title: "Asistan Dr.",
      fullName: "Ali Veli",
      residencyYear: 2,
      consentVersion: KVKK_NOTICE_VERSION,
    });
    expect(Object.keys(sent)).not.toContain("inviteCode");
  });

  it("gönderilen istek sunucu şemasından yeniden geçer (çıktı = geçerli girdi); uzman için kıdem yılı gitmez", async () => {
    serverImpl.mockResolvedValue({ data: { status: "pending", role: "user", alreadyRegistered: false } });
    await completeRegistration({ title: "Uzm. Dr.", fullName: "Ayşe Kaya", consentVersion: KVKK_NOTICE_VERSION });
    const sent = serverImpl.mock.calls[0][1] as Record<string, unknown>;
    expect(sent).not.toHaveProperty("residencyYear");
    expect(CALLABLES.completeRegistration.request.safeParse(sent).success).toBe(true);
  });

  it("sözleşmeye uymayan sunucu yanıtını 'bad-response' olarak reddeder", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    serverImpl.mockResolvedValue({ data: { sessionId: "s1" } }); // endsAtMs eksik
    const err = await callFunction("startLectureSession", {
      title: "Ders",
      lecturer: "Dr. X",
      durationMinutes: 10,
    }).catch((e) => e);
    expect(err).toMatchObject({ code: "bad-response" });
  });

  it("sunucu hatasını Türkçe mesajıyla AppError'a çevirir", async () => {
    serverImpl.mockRejectedValue(
      Object.assign(new Error("Bu işlem yalnızca Eğitim Sorumlusu (Admin) yetkisiyle yapılabilir."), {
        code: "functions/permission-denied",
      })
    );
    const err = await callFunction("endLectureSession", { sessionId: "s1" }).catch((e) => e);
    expect(err).toMatchObject({
      code: "permission-denied",
      message: "Bu işlem yalnızca Eğitim Sorumlusu (Admin) yetkisiyle yapılabilir.",
    });
  });

  it("yapılandırma yoksa sahte yanıt üretmez, 'not-configured' fırlatır", async () => {
    configured.value = false;
    const err = await callFunction("closeQuiz", { quizId: "q1" }).catch((e) => e);
    expect(err).toMatchObject({ code: "not-configured" });
  });
});

describe("adlandırılmış çağrılar", () => {
  it("CALLABLES'taki her sözleşmenin istemcide aynı adlı bir çağrısı vardır", async () => {
    const mod = (await import("@/lib/firebase/callables")) as Record<string, unknown>;
    const missing = Object.keys(CALLABLES).filter((name) => typeof mod[name] !== "function");
    expect(missing).toEqual([]);
  });
});
