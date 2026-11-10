"use client";

import React, { useState } from "react";
import { NineFieldClinicalQuestion, DoctorQuizAttemptLog } from "@/lib/quiz-parser";
import { DoctorGrowthDashboard } from "@/components/quizzes/DoctorGrowthDashboard";
import { ClinicalExamRunner } from "@/components/quizzes/ClinicalExamRunner";
import { InstantFeedbackReport } from "@/components/quizzes/InstantFeedbackReport";
import { AdminQuizStudio } from "@/components/quizzes/AdminQuizStudio";
import { AdminCentralAnalytics } from "@/components/quizzes/AdminCentralAnalytics";
import { useClinicSession } from "@/lib/auth/ClinicSessionContext";
import type { ClinicMemberSession } from "@/lib/auth/types";
import {
  toUserMessage,
  invokeWithFallback,
  saveQuizDraft,
  publishQuiz,
  startQuizAttempt,
  submitQuizAttempt,
} from "@/lib/firebase/callables";

const INITIAL_ACTIVE_QUESTIONS: NineFieldClinicalQuestion[] = [
  {
    id: "q_active_1",
    orderIndex: 1,
    caseContent:
      "2.5 yaşında erkek hasta; 6 gündür süren 39.5°C ateş, bilateral eksüdasız konjonktival hiperemi, çilek dili, servikal 2x2 cm lenfadenopati ve el-ayak sırtında ödem ile başvuruyor.",
    imageUrl: "quiz_media/kawasaki_koroner_eko.png",
    questionText:
      "Bu hastada koroner arter anevrizması gelişimini önlemek için ilk basamak spesifik tedavi kombinasyonu nedir?",
    questionType: "Single Choice",
    maxLength: 0,
    optionsRaw:
      "Tek doz 2 g/kg IVIG + Aspirin (ASA) | Yalnızca yüksek doz Metilprednizolon | 10 gün İntravenöz Seftriakson | Tek başına İbuprofen",
    optionsArray: [
      "Tek doz 2 g/kg IVIG + Aspirin (ASA)",
      "Yalnızca yüksek doz Metilprednizolon",
      "10 gün İntravenöz Seftriakson",
      "Tek başına İbuprofen",
    ],
    correctAnswers: ["Tek doz 2 g/kg IVIG + Aspirin (ASA)"],
    feedbackText:
      "ÖĞRENME NOKTASI: Tam (Klasik) Kawasaki hastalığında semptomların ilk 10 günü içinde 2 g/kg tek doz IVIG (10-12 saatlik infüzyon) ve ASA başlanması, koroner arter anevrizması gelişme oranını %25'ten %4'ün altına indirir.",
  },
  {
    id: "q_active_2",
    orderIndex: 2,
    caseContent:
      "8 aylık süt çocuğu; 2 gündür kusma ve sulu ishal sonrası acil servise getiriliyor. Letarjik, göz küreleri çökük, kapiller dolum zamanı 4 saniye, taşikardik ve cilt turgoru ileri derecede azalmış.",
    imageUrl: "",
    questionText:
      "Ağır dehidratasyon ve hipovolemik şok bulguları olan bu hastada ilk saat içinde uygulanması gereken doğru yaklaşımları seçiniz (Çoklu Seçim):",
    questionType: "Multiple Choice",
    maxLength: 0,
    optionsRaw:
      "20 mL/kg %0.9 NaCl (İzotonik Kristalloid) hızlı IV bolus | Damar yolu 90 sn'de açılamazsa İntraosseöz (IO) erişim | İlk basamakta %5 Dekstroz hipotonik sıvı yüklemesi | Bolus sonrası perfüzyon ve karaciğer boyutunun yeniden değerlendirilmesi",
    optionsArray: [
      "20 mL/kg %0.9 NaCl (İzotonik Kristalloid) hızlı IV bolus",
      "Damar yolu 90 sn'de açılamazsa İntraosseöz (IO) erişim",
      "İlk basamakta %5 Dekstroz hipotonik sıvı yüklemesi",
      "Bolus sonrası perfüzyon ve karaciğer boyutunun yeniden değerlendirilmesi",
    ],
    correctAnswers: [
      "20 mL/kg %0.9 NaCl (İzotonik Kristalloid) hızlı IV bolus",
      "Damar yolu 90 sn'de açılamazsa İntraosseöz (IO) erişim",
      "Bolus sonrası perfüzyon ve karaciğer boyutunun yeniden değerlendirilmesi",
    ],
    feedbackText:
      "ÖĞRENME NOKTASI: Dekompanse hipovolemik şokta 20 mL/kg izotonik kristalloid (%0.9 NaCl veya Ringer Laktat) 5–20 dk içinde verilmelidir. Hipotonik (%5 Dekstroz) sıvılar intravasküler hacmi doldurmaz ve akut hiponatremi/beyin ödemine yol açar.",
  },
  {
    id: "q_active_3",
    orderIndex: 3,
    caseContent:
      "5 yaşında çocuk hasta; havlar tarzda öksürük (barking cough), ses kısıklığı ve inspiratuar stridor ile acil servise başvuruyor. Akciğer grafisinde subglottik daralma ('kalem ucu / çan kulesi' görünümü) saptanıyor.",
    imageUrl: "quiz_media/steeple_sign_ap_boyun.png",
    questionText: "Bu klinik tabloya neden olan en olası tanıyı yazınız (Açık Uçlu Metin - Text Input):",
    questionType: "Text Input",
    maxLength: 40,
    optionsRaw: "",
    optionsArray: [],
    correctAnswers: ["Krup", "Akut laringotrakeobronşit", "Viral krup", "Laringotrakeit"],
    feedbackText:
      "ÖĞRENME NOKTASI: Havlar tarzda öksürük, inspiratuar stridor ve AP boyun grafisinde subglottik daralma (Steeple sign / Kalem ucu belirtisi) viral krup (akut laringotrakeobronşit) için tipiktir. Tedavide tek doz 0.15–0.6 mg/kg Deksametazon temel taştır.",
  },
];

const FALLBACK_USER_SESSION: ClinicMemberSession = {
  uid: "uid_user_1",
  email: "elif.demir@pediatri.edu.tr",
  fullName: "Dr. Elif Demir",
  title: "Asistan Dr.",
  residencyYear: 2,
  role: "user",
  status: "active",
  mfaVerified: true,
  mfaEnrolled: true,
  hasBoundDevice: true,
};

/**
 * MODÜL 4 — ONLINE QUIZ VE KLİNİK VAKA DEĞERLENDİRME SAYFASI (/quizzes)
 *
 * ROL AYRIMI:
 * - User (`role === "user"`): YALNIZCA yayındaki sınava katılır, sınav sorularını çözer, anında
 *   `Feedback_Text` karnesini görür ve kendi eski + şimdiki sınavlarının loglarını kişisel
 *   dashboard (`DoctorGrowthDashboard`) üzerinden takip eder. Hiçbir Admin yetkisi veya sekmesi görmez.
 * - Admin (`role === "admin"`): 9 sütunlu CSV dosyası yükler, sınavı önizler, sınav süresini (dk)
 *   belirler, yayına alır (`AdminQuizStudio`) ve tüm kullanıcıların + tüm sınavların loglarını
 *   merkezi dashboard (`AdminCentralAnalytics`) üzerinden takip eder.
 */
export default function OnlineQuizzesPage() {
  const { session: ctxSession } = useClinicSession();
  const activeSession = ctxSession ?? FALLBACK_USER_SESSION;
  const isAdmin = activeSession.role === "admin";

  const [userStage, setUserStage] = useState<"dashboard" | "exam" | "feedback">("dashboard");
  const [activeQuizTitle, setActiveQuizTitle] = useState<string>(
    "Kasım 2026 — 1. Hafta Çocuk Acil, Kawasaki ve Solunum Acilleri Sınavı"
  );
  const [activeQuizDurationMinutes, setActiveQuizDurationMinutes] = useState<number>(15);
  const [activeQuestions, setActiveQuestions] = useState<NineFieldClinicalQuestion[]>(INITIAL_ACTIVE_QUESTIONS);
  const [archivedQuestions, setArchivedQuestions] = useState<
    Array<NineFieldClinicalQuestion & { sourceQuizTitle: string; archivedAt: string }>
  >([
    {
      ...INITIAL_ACTIVE_QUESTIONS[0],
      id: "arch_oct_1",
      sourceQuizTitle: "Ekim 2026 — Yenidoğan ve Sıvı Elektrolit Sınavı",
      archivedAt: "2026-10-28",
    },
  ]);

  const [allAttempts, setAllAttempts] = useState<DoctorQuizAttemptLog[]>([
    {
      attemptId: "att_oct_1",
      quizId: "quiz_oct_w3",
      quizTitle: "Ekim 2026 — 3. Hafta Pediatrik Nefroloji Sınavı",
      uid: "uid_user_1",
      doctorName: "Asistan Dr. Elif Demir",
      residencyYear: 2,
      submittedAt: "2026-10-20",
      score: 68,
      correctCount: 7,
      totalQuestions: 10,
      tabSwitchCount: 0,
      gradedReport: [],
    },
    {
      attemptId: "att_oct_2",
      quizId: "quiz_oct_w4",
      quizTitle: "Ekim 2026 — 4. Hafta Neonatoloji ve NRP Sınavı",
      uid: "uid_user_1",
      doctorName: "Asistan Dr. Elif Demir",
      residencyYear: 2,
      submittedAt: "2026-10-28",
      score: 84,
      correctCount: 8,
      totalQuestions: 10,
      tabSwitchCount: 0,
      gradedReport: [],
    },
    {
      attemptId: "att_oct_3_burak",
      quizId: "quiz_oct_w4",
      quizTitle: "Ekim 2026 — 4. Hafta Neonatoloji ve NRP Sınavı",
      uid: "uid_user_2",
      doctorName: "Asistan Dr. Burak Şahin",
      residencyYear: 3,
      submittedAt: "2026-10-28",
      score: 90,
      correctCount: 9,
      totalQuestions: 10,
      tabSwitchCount: 1,
      gradedReport: [],
    },
  ]);

  const [inspectedAttempt, setInspectedAttempt] = useState<DoctorQuizAttemptLog | null>(null);

  const personalAttempts = allAttempts.filter((a) => a.uid === activeSession.uid);

  // Karne yalnızca sunucunun ürettiği gradedReport'tan gösterilir; eksikse uydurulmaz (AUDIT C3).
  const openAttemptReport = (att: DoctorQuizAttemptLog) => setInspectedAttempt(att);
  const [submitError, setSubmitError] = useState<string>("");

  return (
    <section aria-labelledby="quizzes-page-heading">
      <div className="page-header">
        <div>
          <h1 id="quizzes-page-heading">
            {isAdmin
              ? "Online Sınav Yönetimi, CSV Yükleme ve Merkezi Log Dashboard'u"
              : "Online Klinik Vaka Sınavı ve Kişisel Gelişim Takibi"}
          </h1>
          <p className="page-header-subtitle">
            {isAdmin
              ? "9 sütunlu CSV dosyası ile sınav yükleyin, önizleyin, sınav süresini belirleyip yayına alın ve tüm hekimlerin sınav loglarını takip edin."
              : "Aktif sınava katılın, sınav sonunda Öğrenme Noktası (Feedback_Text) karnenizi inceleyin ve eski/şimdiki sınav loglarınızı kişisel gelişim panelinizden takip edin."}
          </p>
        </div>
      </div>

      {submitError && (
        <div role="alert" className="clinical-alert critical" style={{ marginTop: "1rem" }}>
          Sınav teslim edilemedi: {submitError}
        </div>
      )}

      {isAdmin ? (
        inspectedAttempt ? (
          <InstantFeedbackReport attempt={inspectedAttempt} onBackToDashboard={() => setInspectedAttempt(null)} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.35rem" }}>
            <AdminCentralAnalytics allAttempts={allAttempts} onInspectAttempt={(att) => openAttemptReport(att)} />
            <AdminQuizStudio
              activeQuizTitle={activeQuizTitle}
              activeQuizDurationMinutes={activeQuizDurationMinutes}
              activeQuestions={activeQuestions}
              archivedQuestions={archivedQuestions}
              onPublishQuizFromCsv={async (newTitle, durationMins, newQuestions) => {
                const { data } = await invokeWithFallback(
                  () =>
                    saveQuizDraft({
                      title: newTitle,
                      durationMinutes: durationMins,
                      closesAtMs: null,
                      sourceFileName: "klinik_vaka_sinavi.csv",
                      questions: newQuestions,
                    }),
                  async () => ({ quizId: `quiz_${Date.now()}`, questionCount: newQuestions.length })
                );
                await invokeWithFallback(
                  () => publishQuiz({ quizId: data.quizId, durationMinutes: durationMins }),
                  () => ({ published: true, archivedPreviousCount: 1 })
                );

                const nowDate = new Date().toISOString().split("T")[0];
                const movedToArchive = activeQuestions.map((q) => ({
                  ...q,
                  id: `arch_${Date.now()}_${q.id}`,
                  sourceQuizTitle: activeQuizTitle,
                  archivedAt: nowDate,
                }));
                setArchivedQuestions((prev) => [...movedToArchive, ...prev]);
                setActiveQuizTitle(newTitle);
                setActiveQuizDurationMinutes(durationMins);
                setActiveQuestions(newQuestions);
              }}
            />
          </div>
        )
      ) : userStage === "exam" ? (
        <ClinicalExamRunner
          quizTitle={activeQuizTitle}
          durationMinutes={activeQuizDurationMinutes}
          questions={activeQuestions}
          onSubmitExam={async (responses, tabSwitchCount) => {
            // Puanlama yalnızca sunucuda yapılır; hata olursa istemcide puan üretilmez (CLAUDE.md kural 5).
            setSubmitError("");
            let graded;
            try {
              graded = await submitQuizAttempt({ quizId: "quiz_active_current", responses, tabSwitchCount });
            } catch (err) {
              setSubmitError(toUserMessage(err));
              setUserStage("dashboard");
              return;
            }
            const newAttempt: DoctorQuizAttemptLog = {
              attemptId: `att_${Date.now()}`,
              quizId: "quiz_active_current",
              quizTitle: activeQuizTitle,
              uid: activeSession.uid,
              doctorName: `${activeSession.title} ${activeSession.fullName}`,
              residencyYear: activeSession.residencyYear,
              submittedAt: new Date().toISOString().split("T")[0],
              score: graded.score,
              correctCount: graded.correctCount,
              totalQuestions: graded.totalQuestions,
              tabSwitchCount,
              gradedReport: graded.gradedReport,
            };
            setAllAttempts((prev) => [newAttempt, ...prev]);
            setInspectedAttempt(newAttempt);
            setUserStage("feedback");
          }}
          onCancel={() => setUserStage("dashboard")}
        />
      ) : userStage === "feedback" && inspectedAttempt ? (
        <InstantFeedbackReport attempt={inspectedAttempt} onBackToDashboard={() => setUserStage("dashboard")} />
      ) : (
        <DoctorGrowthDashboard
          session={activeSession}
          personalAttempts={personalAttempts}
          activeQuizTitle={activeQuizTitle}
          activeQuizQuestionCount={activeQuestions.length}
          activeQuizDurationMinutes={activeQuizDurationMinutes}
          onStartActiveQuiz={async () => {
            await invokeWithFallback(
              () => startQuizAttempt({ quizId: "quiz_active_current" }),
              () => ({ deadlineMs: Date.now() + activeQuizDurationMinutes * 60_000, resumed: false })
            );
            setUserStage("exam");
          }}
          onInspectAttemptReport={(att) => {
            openAttemptReport(att);
            setUserStage("feedback");
          }}
        />
      )}
    </section>
  );
}
