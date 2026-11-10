import { initializeApp } from "firebase-admin/app";

initializeApp();

export {
  syncUserClaims,
  updateMemberAccess,
  completeRegistration,
  createInvitation,
  revokeInvitation,
} from "./members";
export {
  startLectureSession,
  endLectureSession,
  getProjectorCode,
  verifyRealTimeAttendance,
  markAttendanceExcused,
} from "./attendanceService";
export { saveQuizDraft, publishQuiz, closeQuiz, startQuizAttempt, submitQuizAttempt } from "./quizService";
