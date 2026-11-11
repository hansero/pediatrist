import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { closeExpiredLectures } from "./attendanceService";
import { closeExpiredQuizzes, finalizeExpiredAttempts } from "./quizService";
import { REGION } from "./shared/constants";

/**
 * Zamanlanmış işler (F4.1). İş mantığı dışa aktarılan saf fonksiyonlardadır ve doğrudan test edilir;
 * Firebase emülatörü zamanlayıcıları tetiklemez.
 */
export const closeExpiredLecturesJob = onSchedule(
  { schedule: "every 5 minutes", region: REGION, timeZone: "Europe/Istanbul", retryCount: 1 },
  async () => {
    const closed = await closeExpiredLectures();
    if (closed.length) logger.info("Süresi dolan dersler kapatıldı", { count: closed.length, sessionIds: closed });
  }
);

/**
 * Sınav (F5.1): kapanış zamanı geçen sınavları kapatır, ardından süresi (+ tolerans) dolmuş ama teslim
 * edilmemiş girişimleri süre içinde kaydedilmiş yanıtlarla teslim eder (tarayıcısı kapanan hekim puansız kalmaz).
 */
export const closeExpiredQuizzesJob = onSchedule(
  { schedule: "every 5 minutes", region: REGION, timeZone: "Europe/Istanbul", retryCount: 1 },
  async () => {
    const closed = await closeExpiredQuizzes();
    if (closed.length)
      logger.info("Kapanış zamanı geçen sınavlar kapatıldı", { count: closed.length, quizIds: closed });
    const finalized = await finalizeExpiredAttempts();
    if (finalized.length) logger.info("Süresi dolan girişimler teslim edildi", { count: finalized.length });
  }
);
