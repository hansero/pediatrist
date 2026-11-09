# Pediatrist: Full-Stack Audit and Design Critique

## Context

You asked for a report only, with no code changes and nothing pushed. The report covers areas to improve, critical inconsistencies and likely flaws, and for each one it names where to change the code and how. Scope: every file on `feat/pediatrist-platform` @ `a699997`. That is 50 files and about 9k LOC: `functions/src/*`, `firestore.rules`, `storage.rules`, `firebase.json`, `next.config.ts`, all `src/**` pages, components and libs, `src/styles/index.css`, `tests/verify-platform.mjs` and `Plan.MD`. I did not run the app or build it, because plan mode is read-only. Contrast ratios were computed from the HSL tokens in `index.css`.

Severity: 🔴 Critical (it breaks the product's core promise, its security or its data integrity) · 🟡 Moderate · 🟢 Minor / polish.

---

## Overall impression

The **backend is the strongest part**: Cloud Functions with HMAC codes, server-side grading, answer keys split into a closed collection, and an audit log. The **frontend is a high-fidelity prototype that never actually uses that backend**. Every module (attendance, quizzes, materials, admin, dashboard, calculators) renders hard-coded seed data held in React `useState`. It fires the server call and forgets it, and then **shows success whatever the server answered** (`invokeWithFallback` swallows every error). Data from one user is never visible to another user, and nothing survives a page reload. `Plan.MD` marks Phases 1–6 as "Tamamlandı" (complete), and that overstates the product's real state.

The biggest opportunity is not visual. It is wiring each module to Firestore and the callables honestly: real reads, real errors and real loading states. After that, cut the security theatre (fake 2FA, self-attested biometrics, fake QR scan) and replace it with real controls or remove it.

### Module reality matrix (the systemic finding)

| Module | Server side exists | Client reads Firestore | Client uses the callable's result | Persists across reload / users |
|---|---|---|---|---|
| Auth / register | ✅ trigger + rules | ✅ (profile only) | n/a | ✅ |
| 2FA / MFA | ❌ | ❌ | ❌ (any 6 digits pass) | ❌ |
| Attendance | ✅ 5 callables | ❌ (`INITIAL_SESSIONS` mock) | ❌ (`void`, result ignored) | ❌ |
| Quizzes | ✅ 5 callables | ❌ (`INITIAL_ACTIVE_QUESTIONS` mock) | ⚠️ score only, with a client fallback | ❌ |
| Materials | ⚠️ rules only, no functions | ❌ (`INITIAL_MATERIALS` mock) | ❌ (no upload exists) | ❌ |
| Calculators | ⚠️ rules only (`calculators_config`) | ❌ | ❌ | ❌ |
| Admin / members | ✅ `updateMemberAccess` | ✅ `users` snapshot (falls back to mock) | ❌ (`void`, optimistic) | ⚠️ |
| Admin / audit log | ✅ written by functions | ❌ (`useState` mock, local fake entries) | ❌ | ❌ |
| Dashboard | n/a | ❌ (KPIs hard-coded: "76 / 100", "1 Hekim") | n/a | ❌ |

---

## 1. Critical findings (🔴)

### C1. Silent fallback fakes success in production
- **What:** `invokeWithFallback` (`src/lib/firebase/callables.ts:46-74`) catches **every** error and returns client-fabricated data with `syncedWithCloud:false`. That includes `permission-denied`, `invalid-argument`, App Check failures and network failures. No caller checks `syncedWithCloud`, and most call sites use `void invokeWithFallback(...)` and update local state optimistically (`admin/page.tsx:239,290,308,329,346`, `attendance/page.tsx:193,274,303,314`, `quizzes/page.tsx:239,250,277,314`).
- **Impact:** An admin can "approve", "suspend" or "make admin" a member, the UI says it worked, and nothing happened on the server. A doctor sees "Yoklama başarıyla doğrulandı" (attendance confirmed) while the server rejected the check-in. A quiz is graded **client-side** when the callable fails.
- **Where/how:** Delete `invokeWithFallback`. Have `callable()` throw typed errors, and render them with `toUserMessage` (already present at `callables.ts:76`). Keep a demo mode only behind an explicit `NEXT_PUBLIC_DEMO_MODE` flag that also shows a visible "DEMO" banner. Every mutation needs pending, success and error states, and must `await` the call before it changes the UI.

### C2. Attendance module does not work end to end
- `attendance/page.tsx:21-109` hard-codes the roster and sessions. `:111-118` generates the projector code with **`Math.random()` in the browser**. `:142-162` rotates it locally. `:164-236` validates the doctor's input **against the doctor's own local random code**, which the doctor can never see. The real `getProjectorCode` callable is **never called anywhere**.
- `onStartNewSession` (`:272-301`) throws away the server's `sessionId` and uses a local `att_${Date.now()}`. Even if the doctor's code matched, the server would reject the `sessionId`.
- `DoctorRealTimeCheckIn.tsx:86-96`: the **"Projektör Kodunu Kamera ile Tara" (scan the projector code with the camera) button copies the expected code straight from state**. It is a fake scan that, in mock mode, leaks the answer. `:115-124` ships a "Farklı / Kayıtsız Cihaz Simülasyonu (Güvenlik Testi)" (different / unregistered device simulation, security test) option to real doctors. `:126-136` the "biometric" checkbox is self-attested and defaults to `true`, and the server stores it as `method: "qr+webauthn"` (`attendanceService.ts:265`). The audit trail therefore records biometric verification that never happened.
- **Where/how:**
  - (a) Subscribe to `attendance_sessions where status=='live'` and to `attendance_logs` (the admin can read all; a doctor must add `where uid==auth.uid`). The indexes already exist in `firestore.indexes.json`.
  - (b) The projector polls `getProjectorCode` and schedules the next poll at `msUntilRotation`.
  - (c) The doctor submits to `verifyRealTimeAttendance` and renders the server's response or error.
  - (d) Remove the simulation select, the fake scan and the checkbox. Either implement real WebAuthn (see S4) or drop the `webAuthnVerified` parameter and the `qr+webauthn` label server-side.
  - (e) Render an actual QR code that encodes `/attendance?s=<sessionId>&c=<code>`.

### C3. Quiz module is a mock, and the answer key ships in the JS bundle
- `quizzes/page.tsx:24-89` contains three questions **with `correctAnswers` and `feedbackText`** in a client component. They ship to every doctor's browser, which contradicts the "8./9. alan hekime her zaman kapalı" (fields 8 and 9 always closed to the doctor) guarantee in `firestore.rules:133`.
- `quizId: "quiz_active_current"` is hard-coded (`:278,315`), so the real `startQuizAttempt` and `submitQuizAttempt` always fail. They then fall back to **client-side grading** with `evaluateClinicalQuizAttempt`.
- `openAttemptReport` (`:188-201`) **fabricates a doctor's graded report from hard-coded answers** when the report is empty, and shows it to the admin as if it were that doctor's answers. This is a data-integrity problem in an assessment context.
- An admin's publish only updates the admin's own React state, so doctors never see the new quiz.
- **Where/how:**
  - Doctors list `quizzes where status=='published'` and receive the questions **from `startQuizAttempt`**, not by reading `questions_public` directly (see S1).
  - Submit through `submitQuizAttempt` only and remove client grading from the doctor path. Keep `evaluateClinicalQuizAttempt` for the admin CSV preview only, or delete it.
  - History comes from `quiz_attempts where uid==me orderBy submittedAt desc` (indexed). The admin views attempts from `quiz_attempts` and the archive from `quiz_question_archive`.
  - Delete `INITIAL_ACTIVE_QUESTIONS`, the mock attempts and `FALLBACK_USER_SESSION`.

### C4. Two-factor authentication is fake
- `login/page.tsx:34-42`: `handleMfaVerify` accepts **any 6 digits** and redirects. The user is already fully signed in after step 1 (`:24`), so they can also go straight to `/dashboard`. `SessionGuard.tsx:36` claims an "MFA doğrulanmamışsa erişimi engeller" (blocks access without MFA) layer that does not exist. `session.mfaVerified` is computed (`ClinicSessionContext.tsx:70`) but never enforced. `appCheckVerified: true` is hard-coded (`:71`).
- **Where/how:** Enable Identity Platform TOTP MFA. In `login/page.tsx`, catch `auth/multi-factor-auth-required` and call `getMultiFactorResolver` and `TotpMultiFactorGenerator.assertionForSignIn`, then add an enrolment flow for first login. Enforce MFA server-side: callables reject when `request.auth.token.firebase.sign_in_second_factor` is missing, and Firestore rules can do the same for admin paths. Until that exists, **remove the TOTP step**, because security theatre is worse than no claim.

### C5. Suspended or demoted users keep access for up to an hour, and the authorization sources disagree
- `firestore.rules:19-31`: `isActiveMember()` is `token.status=='active' **||** doc.status=='active'`. A suspended user's still-valid ID token (TTL 1 h; `revokeRefreshTokens` does **not** invalidate it for rules) keeps passing. The same applies to a demoted admin through `token.role=='admin' || doc.role=='admin'`.
- Callables use **claims only** (`attendanceService.ts:23-35`, `quizService.ts:36-48`). `updateMemberAccess` alone also falls back to the document (`authTriggers.ts:66-72`). Storage uses **claims only** (`storage.rules:4-11`). The client prefers the **document** (`ClinicSessionContext.tsx:48-58`, the patch in `a699997`).
- Result: a newly approved doctor sees the app as active (document) while every callable and every Storage download returns `permission-denied` (stale claims) until the token refreshes. C1 then hides those errors.
- **Where/how:** Pick **one** source of truth.
  - **Rules:** make the user document authoritative (`get(users/uid).data.status=='active'`; it is cached per request) and also check `request.auth.token.auth_time > userDoc.tokensValidAfter` for instant revocation.
  - **Functions:** add a shared `functions/src/guards.ts` with `requireActive()` and `requireAdmin()` that read the user document (and the `tokensValidAfter` check), and use it in all 12 handlers. This also de-duplicates the three copies of `assertAdmin`.
  - **Client:** in `ClinicSessionContext`, add an `onSnapshot(doc(users/uid))`. When `status`/`role` differ from the claims, call `user.getIdToken(true)`. If the status becomes `suspended`, sign out immediately.
  - **Storage:** Storage rules cannot read Firestore cheaply, but `firestore.get()` is supported in Storage rules (cross-service), so use it there.

### C6. The Content-Security-Policy blocks the backend
- `next.config.ts:28` and `firebase.json:58`: `connect-src` lacks **`https://*.cloudfunctions.net`**, which is where `httpsCallable` sends requests. There is **no `frame-src`**, so `default-src 'self'` blocks the reCAPTCHA Enterprise iframe and App Check cannot obtain a token. Every callable has `enforceAppCheck:true`. There is no `media-src` or `frame-src` for Storage-hosted video or PDF either.
- The policy is duplicated in two files, so it will drift.
- **Where/how:**
  - Add `connect-src … https://*.cloudfunctions.net https://content-firebaseappcheck.googleapis.com`.
  - Add `frame-src https://www.google.com https://recaptcha.google.com` and `media-src 'self' blob: https://firebasestorage.googleapis.com`.
  - Keep the CSP in **one** place (prefer `next.config.ts`, since Next headers apply under webframeworks) and delete the `hosting.headers` copy.
  - Move toward nonce-based `script-src` instead of `'unsafe-inline'` (Next 15 middleware nonce pattern).

### C7. Quiz timer is bypassable and the answer key leaks while the quiz is live
- `firestore.rules:127-130`: any active member can read `questions_public` as soon as a quiz is `published`, **without starting an attempt**. A doctor can read every question, research the answers, then start the timer.
- `quizService.ts:342-389` stores `gradedReport` (including `correctAnswers` and `feedbackText`) in `quiz_attempts`, which the owner can read (`rules:148`). The first doctor to finish therefore holds the full key while the quiz is still open to colleagues.
- **Where/how:**
  - (a) Close `questions_public` to clients. Return the questions from `startQuizAttempt`, including on resume. An alternative rule is `exists(quiz_attempts/$(quizId+'_'+uid)) && get(...).status=='in_progress'`.
  - (b) While the quiz is `published`, return and store only `isCorrect` and `score`. Reveal `correctAnswers` and `feedbackText` after `closeQuiz`, either with a callable `getAttemptReport` that checks the quiz status or by writing the full report on close. Product decision: if instant feedback matters more than integrity, say so explicitly in `Plan.MD`.

### C8. Idle lock kills exams and projector sessions
- `SessionGuard.tsx:22,54-72`: 15 minutes without mouse, keyboard or touch triggers a hard sign-out (`window.location.href = "/login"`).
  - A doctor reading a long case for 15 minutes in an exam of up to 180 minutes loses every answer. Responses are not persisted (`ClinicalExamRunner.tsx:35`).
  - The **admin's projector screen is passive by design** and locks mid-lecture (lectures last up to 240 minutes).
  - There is no pre-lock warning: `remainingSeconds` is computed but never shown.
- **Where/how:** Exempt the exam and projector views, for example with a `SessionGuard` prop `idleExempt` or a context flag the page sets. Add a 60-second warning dialog with "Devam et" (continue). Persist exam responses to `sessionStorage`, or better to a debounced `saveAttemptDraft` callable. For the projector, use a dedicated `/attendance/projector` route with the Screen Wake Lock API and a large-type kiosk layout.

### C9. Registration and admission flow
- `register/page.tsx:24-43`: `createUserWithEmailAndPassword` runs, then `setDoc`. If the second call fails, the account is orphaned and has no profile, the email is now "in use", and the user only sees a generic error.
- The invite code is collected (`:148-160`) and stored but **never validated**. The `invitations` collection is readable by **any** signed-in user, pending ones included (`firestore.rules:59-62`), and is never used.
- There is no email verification and no "forgot password". The create rule (`rules:43-46`) does not restrict keys or the `email` field, so a registrant can write any `email` or `fullName`, and the admin approves based on that spoofable value (`admin/page.tsx:230` shows `m.email` from the document).
- **Where/how:**
  - Move profile creation into a blocking `beforeUserCreated` function, or an `onCall registerMember`, that writes the document server-side from `auth.token.email`, validates and consumes the invitation, and sets the claims.
  - Restrict the rule to `request.resource.data.keys().hasOnly([...])` and `request.resource.data.email == request.auth.token.email`.
  - Require `email_verified` in `requireActive()`.
  - Tighten `invitations` reads to admin only.

### C10. Dashboard and admin panel show fabricated data as if real
- `dashboard/page.tsx:34-59` hard-codes "Canlı Ders Açık" (live lecture open), "15 Dk • 3 Vaka", "76 / 100" and "1 Hekim". `admin/page.tsx:43-114` seeds fictitious members and audit logs. `:124` keeps the seed when the snapshot is empty, and the error handler is a no-op (`:143`). `recordAudit` (`:156-173`) adds **client-side fake audit entries** under "Değiştirilemez Güvenlik Denetim Logları" (immutable security audit logs), with a hard-coded fallback actor `selim.kaya@…`.
- **Where/how:** Replace each KPI with a live query, or a small aggregate document maintained by functions such as `stats/overview`. Read `audit_logs orderBy timestamp desc limit 100` (the index on `resourceType, timestamp` exists) with pagination. Remove all seed arrays. Add proper empty states ("Henüz kayıt yok", meaning no records yet).

### C11. Materials module has no file handling at all
- `AdminMaterialManager.tsx:42-63`: "Firebase Storage'a Yükle ve Yayınla" (upload to Firebase Storage and publish) has **no file input**. It only adds an item to local state, with `uploadedBy` hard-coded to "Prof. Dr. Selim Kaya" (`:55`) and a fake `.slides` extension (`:54`).
- The viewer (`WatermarkedMaterialViewer.tsx:140-150`) renders hard-coded text "pages", never a PDF or video. Reading progress is local only, although `materials/{id}/progress/{uid}` rules exist. `allowDownload` toggles nothing, because there is no download button.
- `storage.rules:14-21` blocks **delete** (`request.resource` is null on delete) and rejects `.pptx`, although the UI offers "Sunum/slides".
- **Where/how:** Use `uploadBytesResumable` to `materials/{materialId}/{file}` with a progress bar, then write a `materials/{id}` document. That needs either a `createMaterial` callable or opening `materials` create to admins with schema validation. Render PDFs with pdf.js onto a canvas under the watermark and video with `<video>`. Write progress to `progress/{uid}` (debounced). Split the Storage rule into `allow create, update: if isAdmin() && size/type` and `allow delete: if isAdmin()`. Add the presentation MIME type, or convert to PDF on upload.

---

## 2. Security and data-integrity findings (🟡)

| # | Finding | Where | Fix |
|---|---|---|---|
| S1 | Device binding relies on a `localStorage` secret. Safari ITP purges it after 7 days without interaction, which causes mismatch lockouts and repeated admin resets. Incognito or a second profile produces a new "device", so the "same device, multiple accounts" check (`attendanceService.ts:238-249`) is trivially bypassed. | `callables.ts:25-40`, `attendanceService.ts:196-209` | Use **WebAuthn platform passkeys** (`@simplewebauthn/server` in functions, `navigator.credentials` on the client). They are real device-bound keys that the server verifies, which also makes the "biometric" claim true. Store the credential ID on the user document (`webAuthnCredentialId` is already reset in `authTriggers.ts:138`). |
| S2 | The code can be relayed. A 15–30 s code shared over WhatsApp lets an absent colleague check in. There is no proximity proof. | `attendanceService.ts:217-223` | Optional coarse geofence (Permissions-Policy already allows geolocation), or an in-room factor. At minimum, flag check-ins from the same `/24` IP or ASN as the projector in the audit log (`ipHash` field exists but is never filled; use `request.rawRequest.ip`). |
| S3 | Attendance writes are not transactional. Concurrent submits double-increment `presentCount`. Excused→present does not decrement `excusedCount`. `markAttendanceExcused` increments on every call even when the record already exists. First-bind device races are possible. | `attendanceService.ts:252-281,313-335` | Wrap them in `db.runTransaction`. Read the existing record, compute deltas (`+1/-1` per status transition) and set `boundDeviceHash` inside the transaction. |
| S4 | The "single live session" check is racy, and expired sessions stay `live` forever. That blocks new sessions and keeps the doctor-facing rule (`status=='live'`) true. `getProjectorCode` ignores `endsAt`. | `attendanceService.ts:66-69,133-155` | Use a lock document (`attendance_meta/live`) in a transaction. Add an `onSchedule` (every 5 min) that closes expired sessions and deletes their secrets. Check `endsAt` in `getProjectorCode`. The same applies to quiz `closesAt` (never auto-closed). |
| S5 | `endLectureSession` doesn't check existence or status. A missing document surfaces as `internal`. | `attendanceService.ts:107-130` | `get` first, then `failed-precondition` / `not-found`. |
| S6 | `submitQuizAttempt` is not transactional, so a double submit (timer auto-submit plus click) re-grades and overwrites. | `quizService.ts:325-389`, `ClinicalExamRunner.tsx:45-55,99-105` | Use a transaction with a status precondition. On the client, add a `submitting` flag, disable the button and guard the timer. |
| S7 | Publishing or closing a quiz while attempts are in progress removes the takers' question access on reload (rules require `published`). | `quizService.ts:205-209`, `rules:128` | Serve the questions from the attempt (see C7). Warn the admin before publishing when there are in-progress attempts (count them). |
| S8 | Input types are not validated server-side. A non-string `title`, `excuseNote` or `lecturer` throws a TypeError, which surfaces as `internal`. `closesAtMs` NaN or in the past is accepted. `residencyYear` is not range-checked (comment says 1–4) and can be NaN in the claims. The `durationMinutes` string `"30"` is rejected in `publishQuiz`. | all callables; `authTriggers.ts:107` | Add a shared **zod** schema module (`functions/src/schemas.ts`) and import the same schemas on the client for forms, so the contracts can't drift (see K1). |
| S9 | `updateMemberAccess` allows self-demotion and removing the **last admin** (lock-out). It creates documents for nonexistent UIDs (`set merge`), and `setCustomUserClaims` then throws `internal`. | `authTriggers.ts:93-141` | Refuse when `targetUid==caller` for role/status changes, and when the result would leave zero active admins. Check `getUser(targetUid)` first. |
| S10 | Audit logging is best-effort and placed after the main write. A failure loses the event. `ipHash`/`userAgent` are never set. There is no retention or export. Invalid-code attempts can be spammed into `audit_logs` (cost and noise). | `auditLogger.ts`, all functions | Write the audit document in the **same batch/transaction**. Fill `ipHash` (salted). Add a Firestore TTL policy plus a BigQuery or Cloud Logging export. Rate-limit per uid (a counter document, or App Check replay protection with `consumeAppCheckToken: true` on sensitive callables). |
| S11 | The `users` create rule lets a registrant set arbitrary fields (`boundDeviceHash`, `approvedBy`, any `residencyYear` → claims). | `firestore.rules:43-46` | `keys().hasOnly(['uid','title','fullName','email','residencyYear','role','status','createdAt'])` plus type and range checks. |
| S12 | `materials/{id}/progress/{uid}` can be written by pending or suspended users and has no schema. | `firestore.rules:71-75` | `isActiveMember() && isOwner(uid) && keys().hasOnly([...])`. |
| S13 | Client-side "DRM" (`user-select:none`, context-menu block) is a deterrent only, but the UI labels it "DRM Korumalı" (DRM protected). | `WatermarkedMaterialViewer.tsx:63-77` | Relabel it "Filigranlı görüntüleme" (watermarked viewing). For real protection, serve rasterised pages from a function with a per-user watermark burned in, and use short-lived signed URLs. |
| S14 | Dependencies: there is **no lockfile committed** (root or `functions/`), so builds are not reproducible. The caret ranges on `next@^15.1.0` and `react@^19.0.0` must resolve to versions patched for the 2025 React/Next RSC advisories (e.g. CVE-2025-55182). | `package.json`, `functions/package.json` | Commit `package-lock.json` for both. Add `npm audit` / Dependabot. Pin to the latest patched 15.x and 19.x. |
| S15 | `measurementId` is wired, but Analytics is not initialised and the CSP does not allow GA. If Analytics is ever enabled, consent is required (KVKK). | `client.ts:28`, `.env.example:11` | Remove it, or add consent gating. |

---

## 3. Usability (critique framework)

| Finding | Severity | Recommendation (where) |
|---|---|---|
| Every mutation reports success without waiting (see C1). No loading or disabled states on publish, approve, start lecture or check-in. | 🔴 | Use an async action hook (`useAsyncAction`) with `pending/error/success`. Disable buttons while pending. Show server errors inline (`role="alert"`). |
| The pending/suspended screen in `SessionGuard.tsx:78-87` has **no sign-out button**, shows the same "awaiting approval" text to *suspended* users, and never refreshes when approval arrives. `/pending` (`pending/page.tsx:9`) shows developer jargon: `Custom Claims: status = "pending"` and `/admin`. | 🔴 | Use separate states for pending and suspended, with plain copy. Add a "Çıkış yap" (sign out) action. Auto-advance when the user-document listener sees `active` (see C5). |
| Destructive and privileged admin actions have no confirmation or undo: one click on "Eğitim Sorumlusu Yap" (make training lead) **grants admin**, and suspend and device reset fire instantly. "Üyeliği Onayla" (approve membership) is shown for *suspended* users too, so "reactivate" is mislabelled. | 🔴 | Use a confirm dialog naming the person and the consequence. Distinguish Approve / Reactivate. Optionally add a type-to-confirm for granting admin. Show a toast with the server result. |
| Exam: "Sınavdan Ayrıl" (leave exam) has no confirmation, and the server attempt stays `in_progress` while the clock keeps running server-side. The timer starts from `durationMinutes` (with a minimum of 60 s), **not** the server `deadlineMs`. On resume the server returns the original deadline, but the client restarts the full time. No 5-minute or 1-minute warnings before auto-submit. | 🔴 | Drive the countdown from `deadlineMs` returned by `startQuizAttempt` (`ClinicalExamRunner.tsx:33`). Confirm before leaving and explain that the clock keeps running. Add timed warnings with an `aria-live` announcement. |
| Exam images are **never rendered**: only the filename is shown (`ClinicalExamRunner.tsx:204-218`). In clinical radiology or derm questions the image *is* the question. | 🔴 | Resolve `quiz_media/...` with `getDownloadURL` and render `<img alt=…>` with zoom/lightbox. The CSP `img-src` already allows Storage. |
| Doctor quiz dashboard always offers "Sınava Katıl" (join exam), even after submission or when no quiz is published. | 🟡 | Drive the state from `quizzes(published)` plus my attempt: *not started / in progress (resume, time left) / submitted (view report) / none*. |
| Materials: the doctor's default filter is "Tüm Kıdemler" (all years), so they see content not targeted to their year. Filter categories (4) ≠ upload categories (6): "Çocuk Kardiyoloji" and "Genel Pediatri" items can't be filtered. "Tamamlandı" (completed) is self-declared at any time (0 s). | 🟡 | Default to `session.residencyYear`. Use a single category enum. Require a minimum view time or last page reached before "complete". |
| Login: no "Şifremi unuttum" (forgot password). No `autoComplete` (`username`, `current-password`, `one-time-code`). TOTP has no `inputMode="numeric"`. The register password has no confirmation field and no strength hint. The Firebase default password policy (6 characters) is looser than the UI says (8). | 🟡 | Add `sendPasswordResetEmail`. Add the attributes. Set a password policy in Identity Platform. |
| Navigation uses `<a href>` (full reload, auth re-bootstrap, "Oturum doğrulanıyor…" (verifying session) flash on every click), shows no active state (`.nav-link.active` exists but is never applied) and has no `aria-current`. | 🟡 | Use `next/link` plus `usePathname()` to set `active` / `aria-current="page"` (`(protected)/layout.tsx:45-76`). |
| Mobile: at ≤960 px the sidebar becomes a full static block **above** the content (`index.css:597-610`). On a phone, the core check-in flow requires scrolling past the whole nav first. | 🟡 | Add a hamburger/drawer or a bottom tab bar on mobile. Put the check-in card first on `/attendance` for doctors. |
| Check-in input: no `autoCapitalize="characters"`, `autoComplete="one-time-code"` or `inputMode`. The 15-second validity is invisible to the doctor. | 🟡 | Add the attributes. Better, make QR deep-link check-in the primary path, with typing as the fallback. |
| Projector code is 2.35 rem (`AdminLiveAttendanceProjector.tsx:321-330`), unreadable from the back of a lecture hall. There is no fullscreen and no QR. The duration max is 180 in the UI but 240 on the server (`:269-274` vs `attendanceService.ts:61`). | 🟡 | Kiosk route with ~15–20 vw monospace code, a QR code, a countdown ring and the Fullscreen API. Align the limits from a shared constant. |
| Admin attendance roster is hard-coded to three people (`CLINIC_ROSTER`), and the default lecturer is hard-coded to "Prof. Dr. Selim Kaya" (`AdminLiveAttendanceProjector.tsx:65`). Attendance-rate denominators use the roster size, not the people who were *expected* (active users at session start). | 🟡 | Build the roster from `users where status=='active' && role=='user'`. Snapshot the expected attendees on the session at start so historical rates stay correct. |
| Quiz analytics group by `doctorName`, not by `uid` (`AdminCentralAnalytics.tsx:28,43`). Two people with the same name merge, and a renamed person splits. | 🟡 | Group by `uid` and display the name. |
| Calculators page is labelled "Yer Tutucu" (placeholder) yet shows "Maksimum Doz Güvenlik Kilidi" (maximum-dose safety lock) as if active. Admin protocol edits are local-only (`calculators/page.tsx:147-194`), although `calculators_config` rules exist. | 🟡 | Either hide the module behind a "Yakında" (coming soon) state, or persist to `calculators_config`. When the formula engine is built: pure functions in `src/lib/pediatrics`, unit-tested against reference values, input range validation, units on every field, a versioned formula, and a "karar desteği; klinik değerlendirmenin yerini almaz" (decision support; does not replace clinical judgement) disclaimer. |
| No `not-found.tsx`, `error.tsx` or `loading.tsx` in the app router. An unhandled render error gives a blank screen. | 🟢 | Add route-level error boundaries with retry. |

---

## 4. Visual hierarchy

- **What draws the eye first:** on every page, a coloured `sec-chip` eyebrow showing **internal routing metadata**: "Modül 4 • /quizzes", "Modül 5 • /admin • Güvenlik & Üye Yönetimi", "/calculators (Yer Tutucu Mimari)". Then come very long H1s such as "Kapalı Devre Üyelik, RBAC ve Siber Güvenlik Denetim Paneli". This is wrong for clinicians: the first thing they see should be the **state and the next action**, for example "Canlı ders açık — yoklamaya katıl" (live lecture open — join attendance) or "Sınavınız 12:40 sonra kapanıyor" (your exam closes in 12:40).
- **Reading flow:** the dashboard leads with 4 KPI cards (fake) and then 4 equal-weight cards with two primary buttons each, so nothing is prioritised. Make the dashboard **state-driven**: one hero card for whatever is live now (lecture or quiz) with a single primary CTA, then secondary items.
- **Emphasis:** the green "verified" chip is reused as a decorative eyebrow ("Eğitim Sorumlusu Yönetim Görünümü", the training-lead management view), which dilutes its success meaning. `sec-chip` serves as label, status, badge, eyebrow and tag, so the colour semantics are unreliable. Reserve success, warning and critical colours for status only, and use a neutral eyebrow style for labels.
- **Copy density:** buttons run 6–10 words ("Sınav Yönetimi ve Analitik Paneline Git", go to the exam management and analytics panel; "Yoklamaya Katıl ve İmzamı Doğrula", join attendance and verify my signature). There is jargon for clinicians (RBAC, HMAC, DRM, Custom Claims, JSON, "9. Alan (Feedback_Text)"). Aim for 1–3 word verbs ("Yoklamaya katıl", join attendance; "Sınavı başlat", start the exam; "Yayınla", publish) and move the explanations into helper text.
- **Whitespace and type:** the scale is reasonable (`clamp` h1/h2, 15 px base). Tables are dense but readable. The heavy inline styles produce many one-off spacing values (0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65 rem…), so vertical rhythm is uneven.

---

## 5. Consistency

| Element | Issue | Recommendation |
|---|---|---|
| CSS tokens | `--status-warn` and `--status-warn-bg` are **undefined**: the tokens are `--status-warning*`. `.clinical-alert.warn` (`index.css:638-642`) and the calculators guardrail box (`calculators/page.tsx:124-125`) render with no colour. | Rename the usages to `--status-warning*`. Add a stylelint "no-unknown-custom-properties" check. |
| Alert classes | `DoctorRealTimeCheckIn.tsx:141` uses `clinical-alert success|critical`, but CSS defines only `.ok/.warn/.err`, so check-in feedback is unstyled. | Standardise on one vocabulary (`success/warning/critical/info`) for `.sec-chip`, `.clinical-alert` and the tokens. |
| Inline styles | Hundreds of `style={{…}}` objects with hard-coded colours (`hsl(210,25%,97%)`, `hsla(204,88%,36%,0.25)`) and spacing. | Extract components such as `<Card>`, `<PageHeader>`, `<StatusChip status>`, `<Alert>`, `<Tabs>`, `<DataTable>`, `<Stat>` and `<EmptyState>`. Add spacing tokens (`--space-1..8`) and use CSS Modules or utility classes. |
| Unused CSS | `.security-topbar`, `.nav-badge` and `.btn-danger` are never used. `.nav-link.active` is never applied. | Remove them or wire them up. |
| Fonts | Google Fonts `@import` in CSS (`index.css:1`) is render-blocking, depends on the CSP and is a privacy leak to Google. `index.css` is imported in 4 places. | Use `next/font/google` (self-hosted) in the root layout and import the CSS once. |
| Domain enums | Categories are defined 3× with different members. `CODE_ALPHABET`, `QUESTION_TYPES`, `REGION`, duration limits (180 vs 240) and text `maxLength` defaults (150 / 250 / 500) are duplicated across client and server. `FALLBACK_USER_SESSION` is duplicated 3×. | Add a shared `shared/` package (or `src/domain/`) imported by both Next and functions, through a TS path or an npm workspace. |
| API contracts | Client response types invent fields the server never returns (`ok`, `success`, `expiresAtMs`, `secondsUntilRotation`, `attemptId`, `isExpired`). The server accepts two parameter names for the same thing (`dynamicToken|dynamicCode`, `deviceId|clientDeviceSecret`, `resetBoundDevice|resetDeviceBinding`). | One request/response schema per callable (zod) in `shared/contracts.ts`, imported by both sides. Remove the aliases. |
| Types location | `ClinicMemberSession`, `ClinicRole` and `MemberStatus` live in a UI component (`SessionGuard.tsx`). Attendance domain types live in `AdminLiveAttendanceProjector.tsx`. | Move them to `src/domain/*`. |
| CSV export | Two implementations. `downloadQuizLogsAsCsv` (`quiz-parser/index.ts:130-161`) has **no formula-injection guard** and never revokes its object URL. Both use `,`, but Turkish-locale Excel expects `;`, so files open in a single column. | Reuse `downloadCsv` everywhere, use `;` (or emit a `sep=;` hint), and keep the BOM. |
| CSV validation | Client and server rules differ. Duplicate options and the `imageUrl` prefix are checked on the client only. The text-answer length check is client-only. Header *names* are never validated, so columns in the wrong order map silently (`quiz-parser/index.ts:261-265`). | A single shared validator, run on both sides. Validate the header names against `NINE_FIELD_CSV_HEADERS`. |
| Naming | `onClinicMemberCreated` is actually an `onDocumentWritten` sync. A `clinic_members` "legacy" fallback is read in the context but nothing writes it. | Rename it `syncUserClaims`. Remove `clinic_members` (rules, context) unless a migration needs it. |

---

## 6. Accessibility

- **Colour contrast (computed):**
  - `--text-muted` on white is **3.65:1, fail** for `.metric-foot` (12 px) and the muted text.
  - The warning chip (`--status-warning` on `--status-warning-bg`) is **3.94:1, fail** for 11.4 px bold.
  - Success 4.94, critical 5.30, primary-on-soft 4.90 and white-on-primary 5.59 pass.
  - **Focus ring** (`--clinical-primary-soft` box-shadow on white) is **1.14:1, fail** (WCAG 1.4.11 / 2.4.11).
  - Input border `--border-strong` is **1.74:1, fail** for 1.4.11 (3:1).
  - Fix: darken `--text-muted` to about `hsl(215,16%,42%)` and `--status-warning` to about `hsl(30,90%,30%)`. Use a 2 px `--clinical-primary` outline with `:focus-visible` on all interactive elements, and use about `hsl(214,18%,58%)` for input borders.
- **Touch targets:** `.btn-sm` is about 28 px tall and is used for primary mobile actions (check-in screen, admin row actions). It passes WCAG 2.5.8 (24 px), but use **≥44 px** on mobile flows.
- **Tabs:** `role="tablist"` buttons lack `role="tab"`, `aria-selected`, `aria-controls`, tabpanels and arrow-key navigation (`AdminLiveAttendanceProjector.tsx:167-192`, `AdminCentralAnalytics.tsx:101-126`, `materials/page.tsx:149-166`, `calculators/page.tsx:35-52`). Build one `<Tabs>` component.
- **Unlabelled controls:** the admin row selects (`admin/page.tsx:232`), the audit severity filter (`:385`), the quiz and doctor filters (`AdminCentralAnalytics.tsx:130-158`) and the excuse-note input (`AdminLiveAttendanceProjector.tsx:368`) have no `<label>` or `aria-label`.
- **Exam:** the radio/checkbox groups lack `<fieldset><legend>`. The nav pills say only "3", with answered state conveyed by colour; they need `aria-label="Soru 3, yanıtlandı"` (question 3, answered). The timer is not announced (add `role="timer"` and a polite live region at 5 min and 1 min). Auto-submit happens without warning.
- **Dialogs:** the idle-lock modal has `aria-modal`, but no focus trap and no initial focus.
- **Errors:** inputs lack `aria-invalid` / `aria-describedby` linking them to error text.
- **Motion:** no `prefers-reduced-motion` handling for smooth scroll or transitions. This is minor.
- **Images:** none are rendered yet (see the exam finding). When they are added, CSV column 2 needs a companion alt-text field, so add a 10th column or derive alt text from the question.

---

## 7. Performance and architecture

- 🟡 The whole app is `"use client"`. App Router SSR and RSC bring no benefit, yet webframeworks deploys an SSR function anyway. `firebase-admin` and `server-only` are root dependencies, and `src/lib/firebase/admin.ts` is **unused**. Either use them (session cookies plus middleware for server-side route gating, which also removes the client-only redirect in `(protected)/layout.tsx:24-27`) or remove them and use `output: "export"` with static hosting.
- 🟡 1 Hz `setInterval` state updates re-render whole pages: the attendance page (`attendance/page.tsx:142-162`), the exam runner (re-renders every question each second, up to 200) and the material viewer. Isolate each timer in a small `<Countdown deadline>` component.
- 🟡 `initPediatristFirebase()` runs on every render of `ClinicSessionProvider` (`ClinicSessionContext.tsx:28`). Memoise it at module level.
- 🟢 `recharts` and `lucide-react` are unused dependencies. The growth chart is hand-made divs without axes or accessible text; use a chart with an accessible table fallback.
- 🟡 Emulators are configured in `firebase.json`, but `client.ts` never calls `connect*Emulator`, and there is no App Check debug-token path, so local development against emulators is impossible.
- 🟡 Region and data residency: functions run in `europe-west1`, but the Next SSR backend defaults to `us-central1` (no `frameworksBackend.region` in `firebase.json`). Set it, and document the Firestore location (KVKK, latency).
- 🟡 Cold starts on `verifyRealTimeAttendance`, which gets a thundering herd at lecture start. Set `minInstances` (time-windowed) and `concurrency` on that function.

---

## 8. Testing, tooling, DevOps

- 🔴 `tests/verify-platform.mjs` **re-implements** the logic inside the tests instead of importing the production modules. Test 2 even uses a **different device-hash formula** (`:93-95` vs `attendanceService.ts:45-48`), so the tests pass whatever production does. Many assertions are string greps for button text, `useRef`, or the presence of mock data (`:5.3`, `:6.3` *enforces* `INITIAL_MATERIALS`). `:8-9` hard-codes an absolute path from another machine (`/home/antigravity/.gemini/...`). `Plan.MD:381` claims Firestore rules tests that do not exist.
  - **Replace them with:**
    - (a) unit tests importing `src/lib/quiz-parser` and the shared validators (Vitest);
    - (b) `@firebase/rules-unit-testing` against the emulator for every rule, especially C5, C7, S11 and S12;
    - (c) `firebase-functions-test` for the callables (status transitions, counters, deadline grace, last-admin guard);
    - (d) Playwright e2e against the emulators for: register → approve → login(MFA) → check-in → quiz → report.
- 🟡 No ESLint config (yet `eslint-disable` comments exist), no Prettier, no `typecheck` script for `functions/`, no CI (`.github/` absent), no lockfiles (S14). Add `next lint` with `eslint-plugin-jsx-a11y`, `tsc --noEmit` for both packages, and a GitHub Actions workflow running lint, typecheck, unit tests, rules tests and build.
- 🟡 Operations: no Firestore backups or PITR, no alerting on `severity=CRITICAL` audit events, no budget alerts, no `firebase.json` `functions.runtime` pin. Add a scheduled export plus a log-based alert.
- 🟢 `README.md` is 2 lines. Add setup (env, emulators, App Check debug token, first-admin bootstrap through the console, which `authTriggers.ts:7-10` documents only in a comment), the deploy order and the architecture.

---

## 9. Privacy and compliance (KVKK)

- 🟡 There is no Aydınlatma Metni (privacy notice) or consent at registration, although the app processes personal data and performance data (scores, attendance, device hashes, IPs if added). Add a notice, consent capture with a version and timestamp, and a data-retention policy.
- 🟡 There is no account deletion or export path. Add an admin "delete member" callable that cascades or anonymises attempts, logs and progress.
- 🟢 Device hashes are unsalted SHA-256 of a client secret. That is fine as is; it becomes moot with WebAuthn.

---

## What works well

- **Server-authoritative design intent:** all writes go through callables, rules deny client writes to sensitive collections, answer keys sit in a separate admin-only collection, and grading is server-side with a deadline plus grace. This is the right architecture. It just needs the client to use it.
- **HMAC rotating codes** with an ambiguous-character-free alphabet, `timingSafeEqual`, previous-slot tolerance and a secret deleted on close.
- **Claims sync trigger** with an idempotence check, and `revokeRefreshTokens` on suspend or device reset.
- **Strict TypeScript** in both packages, and a solid RFC-4180 CSV parser with row-level Turkish error messages and `tr-TR` normalisation.
- **CSV formula-injection guard** in `downloadCsv`, and a BOM for Excel.
- **Good baseline a11y habits:** `lang="tr"`, `aria-labelledby` on sections, `role="alert"` on errors, labelled form fields in the auth flows, tabular numerals for data.
- **Coherent clinical palette** with semantic status pairs that mostly meet AA, and a clear role split between admin and doctor views.
- **The secret hygiene** (`.env.example`, `server-only`, a gitignored `.firebaserc`) is careful.

---

## Priority recommendations (ordered roadmap)

1. **Make failure visible (C1):** remove `invokeWithFallback`, await every call, and add pending/error UI. Do this first, because it unmasks every other bug.
2. **Fix the authorization foundation (C5, C6, C9, S11):** one source of truth (the user document plus `tokensValidAfter`), shared guards in functions, token refresh on the client, CSP fixed for functions and App Check, server-side registration with invitations.
3. **Wire the modules to Firestore in value order:** attendance (C2, S3, S4) → quizzes (C3, C7, S6, S7) → admin and audit (C10, S9, S10) → materials (C11) → dashboard KPIs. Delete all seed data and `FALLBACK_*` sessions.
4. **Real or none (C4, S1, S13):** implement TOTP MFA and WebAuthn passkeys, or remove the claims and the UI for them. Relabel "DRM".
5. **Fix the exam and projector UX (C8, usability table):** idle-lock exemption, server-driven timer, persisted answers, rendered images, kiosk projector with QR.
6. **Design-system pass:** fix the undefined tokens and alert classes, the contrast and focus tokens, extract the components and remove inline styles, add a mobile nav, simplify the copy and remove routing chips.
7. **Shared domain and contracts package, plus real tests and CI (section 8).**
8. **KVKK notice and consent, retention, backups and alerting (section 9).**

---

## How to verify the fixes (once implemented)

- `firebase emulators:start` plus the client wired to the emulators. Run the rules tests (`@firebase/rules-unit-testing`) covering: a suspended user with a fresh token is denied; a doctor can't read `questions_public` without an in-progress attempt; a doctor can't read another doctor's attempt or logs; a registrant can't set extra fields or a spoofed email.
- Callable tests with `firebase-functions-test`: counter deltas under concurrent check-ins; excused↔present transitions; double submit; last-admin guard; expired-session auto-close.
- Playwright e2e on the emulators, at both a 390 px phone viewport and desktop: register → admin approves → doctor's UI flips to active without reload → MFA login → projector shows the server code and QR → doctor checks in on the phone → admin roster updates live → quiz publish → doctor takes it with images → report → admin analytics.
- Manual checks: block `*.cloudfunctions.net` in DevTools and confirm the UI shows an error, not success. Run an axe scan (0 serious). Lighthouse a11y ≥ 95. Re-run the contrast ratios for the token changes.

---

