import { beforeEach, describe, expect, it, vi } from "vitest";

// Firebase SDK'yı taklit et: httpsCallable(functions, name)(data) → serverImpl(name, data)
const serverImpl = vi.fn<(name: string, data: unknown) => Promise<{ data: unknown }>>();
const httpsCallable = vi.fn((_functions: unknown, name: string) => (data: unknown) => serverImpl(name, data));
vi.mock("firebase/functions", () => ({ httpsCallable: (f: unknown, n: string) => httpsCallable(f, n) }));
const configured = { value: true };
vi.mock("@/lib/firebase/client", () => ({
  initPediatristFirebase: () => (configured.value ? { functions: {} } : null),
  isFirebaseConfigured: () => configured.value,
}));

const { callFunction, startLectureSession, verifyRealTimeAttendance, invokeWithFallback, completeRegistration } =
  await import("@/lib/firebase/callables");
const { AppError } = await import("@/lib/errors");

const DEVICE = "d".repeat(32);

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
    const res = await verifyRealTimeAttendance({ sessionId: " s1 ", code: " k9p4x2 ", deviceId: DEVICE });
    expect(res).toEqual({ verified: true, alreadyRecorded: false });
    expect(serverImpl).toHaveBeenCalledWith("verifyRealTimeAttendance", {
      sessionId: "s1",
      code: "K9P4X2",
      deviceId: DEVICE,
    });
  });

  it("şemanın ürettiği undefined alanları göndermez (SDK onları null'a çevirir ve sunucu reddeder)", async () => {
    serverImpl.mockResolvedValue({ data: { status: "pending", role: "user", alreadyRegistered: false } });
    await completeRegistration({ title: "Asistan Dr.", fullName: "Ali Veli", residencyYear: 2, inviteCode: "" });
    const sent = serverImpl.mock.calls[0][1] as Record<string, unknown>;
    expect(sent).toEqual({ title: "Asistan Dr.", fullName: "Ali Veli", residencyYear: 2 });
    expect(Object.keys(sent)).not.toContain("inviteCode");
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

describe("invokeWithFallback (deprecated geçiş katmanı)", () => {
  it("hatayı yutmadan önce konsola yazar", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    serverImpl.mockRejectedValue(Object.assign(new Error("x"), { code: "functions/internal" }));
    const res = await invokeWithFallback(
      () => callFunction("closeQuiz", { quizId: "q1" }),
      () => ({ closed: true })
    );
    expect(res.syncedWithCloud).toBe(false);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("C1"), expect.anything());
  });
});

describe("adlandırılmış çağrılar", () => {
  it("CALLABLES'taki her sözleşmenin istemcide aynı adlı bir çağrısı vardır", async () => {
    const mod = (await import("@/lib/firebase/callables")) as Record<string, unknown>;
    const { CALLABLES } = await import("@shared/schemas");
    const missing = Object.keys(CALLABLES).filter((name) => typeof mod[name] !== "function");
    expect(missing).toEqual([]);
  });
});
