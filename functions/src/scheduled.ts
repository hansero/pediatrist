import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { closeExpiredLectures } from "./attendanceService";
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
