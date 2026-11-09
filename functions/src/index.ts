import * as admin from "firebase-admin";

admin.initializeApp();

export { onClinicMemberCreated, updateMemberAccess } from "./authTriggers";
export {
  startLectureSession,
  endLectureSession,
  getProjectorCode,
  verifyRealTimeAttendance,
  markAttendanceExcused,
} from "./attendanceService";
export { saveQuizDraft, publishQuiz, closeQuiz, startQuizAttempt, submitQuizAttempt } from "./quizService";
