# Contracts reference

Compact index of the data layer so future sessions don't re-derive it. Signatures
reflect the code as of M3 (`src/lib/queries/**`, `src/lib/auth-guards.ts`). If this
drifts from the source, the source wins — update this file, not the other way round.

## 1. Functions

### `src/lib/auth-guards.ts`

| Signature | Returns | Outside request context? |
|---|---|---|
| `findCurrentUserById(userId: string): Promise<CurrentUser \| null>` | user row (no passwordHash) or null if missing/inactive | Yes — pure DB read |
| `findEnrollment(userId: string, programId: string): Promise<Enrollment \| null>` | the enrollment row, any accessState | Yes |
| `isEnrollmentGranted(enrollment: Enrollment \| null): boolean` | `accessState === GRANTED` | Yes — pure function |
| `isMentorForBatch(user: Pick<CurrentUser,"id"\|"role">, batchId: string): Promise<boolean>` | true if ADMIN, or MENTOR with a matching MentorAssignment | Yes |
| `getCurrentUser(): Promise<CurrentUser \| null>` | session user, re-fetched from DB, or null | **No** — calls `auth()` |
| `requireUser(): Promise<CurrentUser>` | user, else `redirect("/login")` | **No** |
| `requireRole(...roles: Role[]): Promise<CurrentUser>` | user, else `forbidden()` | **No** |
| `requireEnrollment(programId: string): Promise<Enrollment>` | caller's enrollment, else `forbidden()` | **No** |
| `requireGrantedEnrollment(programId: string): Promise<Enrollment>` | same, also requires GRANTED, else `forbidden()` | **No** |
| `requireMentorForBatch(batchId: string): Promise<CurrentUser>` | user, else `forbidden()` | **No** |

`CurrentUser = { id, name, email, role, onboardingComplete, streakDays }`. The `require*`
functions need `next/navigation`'s request context (`forbidden`/`redirect`) —
only the pure predicates above them are callable from a script (see
`scripts/verify-guards.ts`).

### `src/lib/queries/programs.ts`
- `getPublishedPrograms(): Promise<PublishedProgram[]>` — catalog grid, `status: PUBLISHED`. Server-only, no auth needed.
- `getProgramForCatalog(slug: string): Promise<ProgramForCatalog | null>` — program + outcomes + modules + lessons, no progress.
- `getEnrollableBatches(programId: string): Promise<EnrollableBatch[]>` — UPCOMING/ACTIVE batches with live seat counts.

### `src/lib/queries/enrollments.ts`
- `getEnrollmentsForUser(userId: string): Promise<EnrollmentWithProgram[]>` — all enrollments + program + batch.
- `getEnrollmentWithProgram(enrollmentId: string): Promise<EnrollmentWithProgram | null>` — single lookup.

### `src/lib/queries/progress.ts` — THE shared calculation
- `getProgramProgress(enrollmentId: string): Promise<ProgramProgress>` — one query (nested module/lesson tree + completed LessonProgress +, per lesson, its linked Assessment's latest attempt for THIS enrollment +, per module, its Assignments' latest submission for this enrollment (M5a) — still one query, bounded nested selects, not a loop), then in-memory aggregation. `{ overallPercent, totalLessons, completedLessons, modules: ModuleProgress[] }`. Each `LessonProgressSummary` now also carries `assessmentId` and `attemptState: AttemptState | null` (M4.5) — `"not_attempted" | "in_progress" | "failed"`, or `null` when the lesson isn't a linked quiz OR is already `completed` (the existing checkmark already means "passed"; no separate badge then). Each `ModuleProgress` also carries `assignments: ModuleAssignmentSummary[]` (M5a) — `{ id, title, type, dueAt, state, score, maxScore }`, `state` one of `AssignmentSubmissionState = "not_started" | "submitted" | "under_review" | "revision_requested" | "reviewed"`. Assignment state is **not** folded into `totalLessons`/`completedLessons`/`overallPercent` — see Rules (D3).
- `findNextIncompleteLesson(progress: ProgramProgress): { moduleId; lesson } | null` — pure, no query.
- `flattenLessons(progress: ProgramProgress): LessonProgressSummary[]` — pure, no query; used for prev/next nav.

### `src/lib/progress-rollup.ts` — M4.5
- `refreshEnrollmentProgress(enrollmentId: string): Promise<ProgramProgress>` — THE rollup: `getProgramProgress` then caches `overallPercent` onto `Enrollment.progressPercent`. Both `markLessonComplete` and `submitAttempt`'s quiz-completion step call this instead of each inlining it — do not duplicate this logic a third time.

### `src/lib/queries/lessons.ts`
- `resolveLessonProgram(lessonId: string): Promise<{ programId; moduleId } | null>` — cheap lookup for guards, called BEFORE `requireGrantedEnrollment`.
- `getLessonDetail(lessonId: string, enrollmentId: string): Promise<LessonDetail | null>` — full content + this enrollment's notes/completed + `assessmentId` (M4.5, nullable). Call only after a guard produced `enrollmentId`. Does NOT itself fetch assessment details — callers with a non-null `assessmentId` call `getAssessmentOverview` separately (reused verbatim, not re-derived).

### `src/lib/queries/dashboard.ts`
- `getDashboardData(userId: string): Promise<DashboardData>` — `DashboardData` is `null` when no GRANTED+ACTIVE enrollment exists (render empty state). Otherwise: learner name/streak, `ProgramProgress`, next incomplete lesson, next unsubmitted assignment by nearest `dueAt`, last-5 merged activity feed (completed lessons + submitted assignments).

### `src/lib/queries/certificates.ts`
- `getCertificatesForUser(userId: string): Promise<LearnerCertificate[]>`.
- `getCertificateDetailForUser(certificateId: string): Promise<CertificateDetailForUser | null>` — includes `userId` *only* so the `[id]` page can verify ownership before rendering; the page must `forbidden()` when `userId` doesn't match the caller.
- `getCertificateForVerification(certificateNumber: string): Promise<VerifiedCertificate | null>` — backs the PUBLIC `/verify/[certificateNumber]` route. Returns **exactly** `{ learnerName, programName, issuedAt, status }`, nothing else — never add `userId`/email/batch/enrollment fields to this query or its return type.

### `src/lib/shuffle.ts` — pure, no DB
- `seededShuffle<T>(items: T[], seed: string): T[]` — string-hash → mulberry32 PRNG → sort-key shuffle. Same `seed` always reproduces the same permutation.

### `src/lib/queries/assessments.ts`
- `resolveAssessmentProgram(assessmentId: string): Promise<{ programId; moduleId } | null>` — cheap lookup for guards, called BEFORE `requireGrantedEnrollment`. Mirrors `resolveLessonProgram`.
- `getAssessmentOverview(assessmentId: string, enrollmentId: string): Promise<AssessmentOverview | null>` — title/time-limit/question-count/`allowedAttempts` + this enrollment's finished-attempt count + an in-progress attempt id if one exists + (M4.5) `programId`/`programName`/`moduleTitle`/`lesson: {id,title} | null` for breadcrumbs. Powers the pre-attempt page AND the lesson page's QUIZ content (reused as-is, not re-derived).
- `getAttemptForGuard(attemptId: string): Promise<AttemptGuardInfo | null>` — one query joining the attempt to its assessment/module/program + (M4.5) `lessonId: string | null` if the assessment is linked to a quiz lesson; used by every attempt-scoped action AND the attempt page to decide ownership, expiry, and which view to render.
- `getLiveAttemptQuestions(assessmentId, attemptId, shuffle): Promise<LiveAttemptQuestion[]>` — questions in **seeded-shuffle order** (see Rules below) merged with saved `Answer` rows. Never selects `isCorrect`/`explanation` from the DB — not merely hidden client-side, actually absent from the query, for an IN_PROGRESS attempt.
- `getGradedAttemptQuestions(assessmentId, attemptId, shuffle): Promise<GradedAttemptQuestion[]>` — same, but includes `isCorrect`/`explanation`. Callers only invoke this when `Assessment.showResultsImmediately` is true.

### `src/lib/queries/assignments.ts` — M5a
- `resolveAssignmentProgram(assignmentId: string): Promise<{ programId; moduleId } | null>` — mirrors `resolveAssessmentProgram`.
- `getAssignmentDetail(assignmentId: string, enrollmentId: string): Promise<AssignmentDetail | null>` — assignment + requirements/instructions (parsed `Json`) + resources + rubric criteria (shown BEFORE submitting) + this enrollment's **real** submission history (`status !== NOT_STARTED`, ordered by `attemptNumber` asc).
- `nextAttemptNumber` / `canSubmitNewAttempt` — pure, no DB. The single source of truth for "can this learner submit right now", shared by the assignment page's render decision and `submitAssignment`'s guard — never duplicated. See Rules for the exact rule (NOT_STARTED handling, REVISION_REQUESTED vs `maxAttempts`).
- `getSubmissionWithReview(submissionId: string): Promise<SubmissionWithReview | null>` — submission + assignment title + the owning enrollment's `userId` (the ownership check, in the same query) + review with mentor name and rubric scores joined to their criteria.

### `src/lib/queries/activity.ts`
- `getLearningHoursStats(userId: string): Promise<LearningHoursStats>` — `{ totalHours, weeklyActivity }`, see Known Gaps.

## 2. Route table

| Path | Guard | Queries composed |
|---|---|---|
| `/programs` | none (public) | `getPublishedPrograms` |
| `/programs/[slug]` | none (public); `auth()` read-only for CTA state | `getProgramForCatalog`, `getEnrollableBatches` |
| `/programs/[slug]` → `enrollAction` | `requireRole(LEARNER)` | re-verifies batch server-side, `prisma.enrollment.count` for capacity, `prisma.enrollment.create` (catches P2002) |
| `/learn` (layout) | `requireRole(LEARNER, ADMIN)` | — |
| `/learn` (page) | `requireUser` | `getDashboardData` |
| `/learn/my-learning` | `requireUser` | `getEnrollmentsForUser`, then `getProgramProgress` per GRANTED enrollment |
| `/learn/programs/[programId]` | `requireGrantedEnrollment(programId)` | `getProgramProgress` |
| `/learn/lessons/[lessonId]` | `resolveLessonProgram` then `requireGrantedEnrollment` | `getLessonDetail`, `getProgramProgress` (sidebar/prev-next via `flattenLessons`), + `getAssessmentOverview` when `lesson.assessmentId` is set (QUIZ lessons only) |
| `/learn/lessons/[lessonId]` → `markLessonComplete` | `resolveLessonProgram` then `requireGrantedEnrollment` | upserts `LessonProgress`, calls `refreshEnrollmentProgress`. Not rendered at all for `QUIZ` lessons — see the completion rule below |
| `/learn/lessons/[lessonId]` → `saveLessonNotes` | same as above | upserts `LessonProgress.notes` |
| `/learn/progress` | `requireUser` | `getEnrollmentsForUser`, `getLearningHoursStats`, `getCertificatesForUser`, `getProgramProgress` per GRANTED enrollment |
| `/learn/assessments/[assessmentId]` | `requireGrantedEnrollment` (via `resolveAssessmentProgram`) | `getAssessmentOverview`; `startAttempt` Server Action resumes an `IN_PROGRESS` attempt or creates the next `attemptNumber`, rejecting when `allowedAttempts` is exhausted |
| `/learn/attempts/[attemptId]` | `getAttemptForGuard` → `requireGrantedEnrollment` → verify `attempt.enrollmentId` matches | `getLiveAttemptQuestions` (in progress) or `getGradedAttemptQuestions`/none (graded, per `showResultsImmediately`); `saveAnswer`/`toggleFlag`/`submitAttempt` Server Actions, each independently re-authorizing (see Rules). `submitAttempt` also completes the linked `QUIZ` lesson per the completion rule below, via `refreshEnrollmentProgress` |
| `/learn/certificates` | `requireUser` | `getCertificatesForUser` |
| `/learn/certificates/[id]` | `requireUser`, then verify `certificate.userId === user.id` (`forbidden()` otherwise) | `getCertificateDetailForUser` |
| `/verify/[certificateNumber]` | **none — PUBLIC**, no `/learn` chrome | `getCertificateForVerification`; not-found/`REVOKED` render an inline negative-result panel, never `notFound()`/a thrown error |
| `/learn/assignments/[assignmentId]` | `requireGrantedEnrollment` (via `resolveAssignmentProgram`) | `getAssignmentDetail`; `submitAssignment` Server Action — see Rules for the exact resubmission gate |
| `/learn/submissions/[submissionId]` | `requireUser`, then verify `submission.userId === user.id` (`forbidden()` otherwise) — no program resolution needed, same pattern as `/learn/certificates/[id]` | `getSubmissionWithReview` |
| `/mentor`, `/admin` (layouts) | `requireRole(MENTOR, ADMIN)` / `requireRole(ADMIN)` | placeholder pages, no queries yet |

## 3. Rules

- **All progress percentages come from `getProgramProgress`.** No page computes its own — if a screen needs a percentage, it calls this (or reuses an already-fetched `ProgramProgress`).
- **Every Server Action re-verifies enrollment server-side.** IDs in the request (lessonId, programId, batchId) are attacker-controlled — never trust them without re-resolving and re-checking `requireGrantedEnrollment`/`requireRole` inside the action itself, even if the calling page already checked.
- **Learning hours and weekly activity are DERIVED, not tracked.** `getLearningHoursStats` sums `Lesson.durationMins` over completed lessons — there is no time-tracking model. Label this honestly in UI copy ("Est. Learning Hours"), never as measured time.
- **Streak comes from `User.streakDays`** — a stored counter, not derived from activity. Any screen showing a streak reads this field (via `requireUser()`'s `CurrentUser` or a direct `user.streakDays` select), never recomputed.
- **Shuffled question order is derived, not stored.** There is no `Attempt.questionOrder` column. `getLiveAttemptQuestions`/`getGradedAttemptQuestions` run `seededShuffle(questions, attemptId)` when `Assessment.shuffleQuestions` is true — `attemptId` never changes after creation, so the same order comes back on every load with zero persisted state. Do not add a stored-order column without removing this derivation (they'd disagree).
- **The attempt deadline is always recomputed server-side** as `Attempt.startedAt + Assessment.timeLimitMins`, never read from the client. `/learn/attempts/[attemptId]`'s page checks this on every load and grades-in-place (calls the same `submitAttempt` the Submit button calls) if it's already passed, before rendering anything. The client's countdown is cosmetic.
- **`CODE_SNIPPET` questions are never auto-graded.** `submitAttempt`'s grading sums `Question.points` only over `MULTIPLE_CHOICE`/`TRUE_FALSE`; a `CODE_SNIPPET` answer's `freeTextAnswer` is stored but contributes nothing to `scorePercent`. `status` still becomes `GRADED` — there is no "awaiting manual review" `AttemptStatus`. A future grading UI would query `GRADED` attempts' `Answer` rows where `Question.type = CODE_SNIPPET`.
- **No file uploads (M5a, D1).** No object storage is configured. `Submission.fileUrl` stays in the schema (seed-only, historical) but the submit form only ever collects `githubUrl` (gated on `Assignment.allowGithubUrl`) and `notes`. The UI says file upload is coming rather than rendering a dead input.
- **Assignments are module-level (M5a, D2).** `Assignment` has no `Lesson` FK — deliberately not added, unlike `Lesson.assessmentId`. They render as an "Assignments" section inside each expanded `CurriculumAccordion` module, not attached to a specific lesson.
- **Assignment state never touches `Enrollment.progressPercent` (M5a, D3).** Progress stays lesson-based. `submitAssignment` never calls `refreshEnrollmentProgress`.
- **A `NOT_STARTED` `Submission` row is a seed placeholder, not a real attempt (M5a).** The seed creates one for Priya Sharma / Data Cleaning Assignment to demonstrate "nothing submitted yet" as real DB state rather than an absent row. It's excluded from `getAssignmentDetail`'s history, excluded from attempt counting, and can never coexist with a real row for the same assignment+enrollment — `submitAssignment` `upsert`s onto its exact `attemptNumber` slot (converting it in place) instead of colliding with it via a plain `create`.
- **`REVISION_REQUESTED` bypasses `maxAttempts` entirely (M5a).** `canSubmitNewAttempt` (`queries/assignments.ts`) blocks a new submission only when the latest is `SUBMITTED`/`UNDER_REVIEW`; when it's `REVISION_REQUESTED`, a new attempt is always allowed regardless of how many real attempts already exist — a mentor asking for a revision isn't the same thing as the learner spending their own attempts. The numeric cap applies only when the latest is `REVIEWED` (or there's no submission yet). Confirmed intentionally: the seed's Marcus Wei fixture has `maxAttempts: 1` already used by a `REVISION_REQUESTED` submission and is expected to still be resubmittable.
- **`dueAt` is informational only (M5a).** A late submission is accepted; the assignment page just shows a "Past Due" flag. `submitAssignment` never blocks on it.
- **A `QUIZ` lesson completes itself (M4.5).** When `Lesson.assessmentId` is set, `submitAttempt` marks that lesson's `LessonProgress.completed = true` iff `Assessment.passingScorePercent === null` (no threshold — any submission counts) OR the attempt's `passed === true`. A failed attempt (a threshold exists and wasn't met) does nothing — no upsert, and it does NOT un-mark a lesson completed by an earlier passing attempt (completion is monotonic; a later failed retake never revokes an earlier pass). The manual "Mark as Complete" button (`markLessonComplete`) is not rendered at all for `QUIZ` lessons. Both paths call `refreshEnrollmentProgress` (`src/lib/progress-rollup.ts`) — never recompute the rollup inline a third way.

## 4. Known gaps (schema does not model these — do not fabricate)

- **Skills / skill proficiency** — no `Skill` model. Any "skills acquired" UI needs a real field added first.
- **Real time tracking** — no session/duration log; see Learning Hours rule above.
- **Program categories** — `Program` has no category/tag field; catalog filter chips are not built.
- **"Saved" enrollment state** — My Learning's Stitch reference shows a Saved tab; no backing field exists (`EnrollmentStatus` has no SAVED value). Dropped, not faked.
~~Assignment-taking UI~~ — resolved in M5a: `/learn/assignments/[id]` and `/learn/submissions/[id]`, wired into `CurriculumAccordion` and the dashboard. Mentor-side grading UI is still unbuilt (M5b).

~~Assessments have no curriculum entry point~~ — resolved in M4.5: `Lesson.assessmentId` (optional, unique FK) links a `QUIZ` lesson to its `Assessment`; `CurriculumAccordion` and the lesson page both surface it now. Two of the seed's three original `QUIZ` lessons had no backing `Assessment` at all and were converted to `READING` rather than authoring new question banks (see `prisma/seed.ts` comments near `FORGE_DATA_ANALYST_MODULES`) — a program can still have a `QUIZ` lesson with a null `assessmentId` at the schema level; both the lesson page and `getProgramProgress`'s `attemptState` derivation handle that (`null`) gracefully rather than assuming it can't happen.
