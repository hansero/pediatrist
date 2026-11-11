import { initializeApp } from "firebase-admin/app";

initializeApp();

export {
  syncUserClaims,
  updateMemberAccess,
  completeRegistration,
  createInvitation,
  revokeInvitation,
  resetMemberMfa,
} from "./members";
export {
  startLectureSession,
  endLectureSession,
  getProjectorCode,
  verifyRealTimeAttendance,
  markAttendanceExcused,
} from "./attendanceService";
export { beginDeviceRegistration, finishDeviceRegistration, beginAttendanceAssertion } from "./webauthn";
export { closeExpiredLecturesJob, closeExpiredQuizzesJob } from "./scheduled";
export {
  saveQuizDraft,
  updateQuizDraft,
  deleteQuizDraft,
  publishQuiz,
  closeQuiz,
  startQuizAttempt,
  saveAttemptDraft,
  submitQuizAttempt,
  getAttemptReport,
} from "./quizService";
export { createMaterial, finalizeMaterialUpload, updateMaterial, deleteMaterial } from "./materialsService";
export { updateCalculatorConfig } from "./calculatorsService";
export { acceptConsent, deleteMember, exportMemberData } from "./privacyService";
