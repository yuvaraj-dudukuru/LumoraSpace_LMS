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
- `getProgramProgress(enrollmentId: string): Promise<ProgramProgress>` — one query (nested module/lesson tree + completed LessonProgress), then in-memory aggregation. `{ overallPercent, totalLessons, completedLessons, modules: ModuleProgress[] }`.
- `findNextIncompleteLesson(progress: ProgramProgress): { moduleId; lesson } | null` — pure, no query.
- `flattenLessons(progress: ProgramProgress): LessonProgressSummary[]` — pure, no query; used for prev/next nav.

### `src/lib/queries/lessons.ts`
- `resolveLessonProgram(lessonId: string): Promise<{ programId; moduleId } | null>` — cheap lookup for guards, called BEFORE `requireGrantedEnrollment`.
- `getLessonDetail(lessonId: string, enrollmentId: string): Promise<LessonDetail | null>` — full content + this enrollment's notes/completed. Call only after a guard produced `enrollmentId`.

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
- `getAssessmentOverview(assessmentId: string, enrollmentId: string): Promise<AssessmentOverview | null>` — title/time-limit/question-count/`allowedAttempts` + this enrollment's finished-attempt count + an in-progress attempt id if one exists. Powers the pre-attempt page.
- `getAttemptForGuard(attemptId: string): Promise<AttemptGuardInfo | null>` — one query joining the attempt to its assessment/module/program; used by every attempt-scoped action AND the attempt page to decide ownership, expiry, and which view to render.
- `getLiveAttemptQuestions(assessmentId, attemptId, shuffle): Promise<LiveAttemptQuestion[]>` — questions in **seeded-shuffle order** (see Rules below) merged with saved `Answer` rows. Never selects `isCorrect`/`explanation` from the DB — not merely hidden client-side, actually absent from the query, for an IN_PROGRESS attempt.
- `getGradedAttemptQuestions(assessmentId, attemptId, shuffle): Promise<GradedAttemptQuestion[]>` — same, but includes `isCorrect`/`explanation`. Callers only invoke this when `Assessment.showResultsImmediately` is true.

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
| `/learn/lessons/[lessonId]` | `resolveLessonProgram` then `requireGrantedEnrollment` | `getLessonDetail`, `getProgramProgress` (for sidebar/prev-next via `flattenLessons`) |
| `/learn/lessons/[lessonId]` → `markLessonComplete` | `resolveLessonProgram` then `requireGrantedEnrollment` | upserts `LessonProgress`, recomputes `getProgramProgress`, caches onto `Enrollment.progressPercent` |
| `/learn/lessons/[lessonId]` → `saveLessonNotes` | same as above | upserts `LessonProgress.notes` |
| `/learn/progress` | `requireUser` | `getEnrollmentsForUser`, `getLearningHoursStats`, `getCertificatesForUser`, `getProgramProgress` per GRANTED enrollment |
| `/learn/assessments/[assessmentId]` | `requireGrantedEnrollment` (via `resolveAssessmentProgram`) | `getAssessmentOverview`; `startAttempt` Server Action resumes an `IN_PROGRESS` attempt or creates the next `attemptNumber`, rejecting when `allowedAttempts` is exhausted |
| `/learn/attempts/[attemptId]` | `getAttemptForGuard` → `requireGrantedEnrollment` → verify `attempt.enrollmentId` matches | `getLiveAttemptQuestions` (in progress) or `getGradedAttemptQuestions`/none (graded, per `showResultsImmediately`); `saveAnswer`/`toggleFlag`/`submitAttempt` Server Actions, each independently re-authorizing (see Rules) |
| `/learn/certificates` | `requireUser` | `getCertificatesForUser` |
| `/learn/certificates/[id]` | `requireUser`, then verify `certificate.userId === user.id` (`forbidden()` otherwise) | `getCertificateDetailForUser` |
| `/verify/[certificateNumber]` | **none — PUBLIC**, no `/learn` chrome | `getCertificateForVerification`; not-found/`REVOKED` render an inline negative-result panel, never `notFound()`/a thrown error |
| `/mentor`, `/admin` (layouts) | `requireRole(MENTOR, ADMIN)` / `requireRole(ADMIN)` | placeholder pages, no queries yet |

## 3. Rules

- **All progress percentages come from `getProgramProgress`.** No page computes its own — if a screen needs a percentage, it calls this (or reuses an already-fetched `ProgramProgress`).
- **Every Server Action re-verifies enrollment server-side.** IDs in the request (lessonId, programId, batchId) are attacker-controlled — never trust them without re-resolving and re-checking `requireGrantedEnrollment`/`requireRole` inside the action itself, even if the calling page already checked.
- **Learning hours and weekly activity are DERIVED, not tracked.** `getLearningHoursStats` sums `Lesson.durationMins` over completed lessons — there is no time-tracking model. Label this honestly in UI copy ("Est. Learning Hours"), never as measured time.
- **Streak comes from `User.streakDays`** — a stored counter, not derived from activity. Any screen showing a streak reads this field (via `requireUser()`'s `CurrentUser` or a direct `user.streakDays` select), never recomputed.
- **Shuffled question order is derived, not stored.** There is no `Attempt.questionOrder` column. `getLiveAttemptQuestions`/`getGradedAttemptQuestions` run `seededShuffle(questions, attemptId)` when `Assessment.shuffleQuestions` is true — `attemptId` never changes after creation, so the same order comes back on every load with zero persisted state. Do not add a stored-order column without removing this derivation (they'd disagree).
- **The attempt deadline is always recomputed server-side** as `Attempt.startedAt + Assessment.timeLimitMins`, never read from the client. `/learn/attempts/[attemptId]`'s page checks this on every load and grades-in-place (calls the same `submitAttempt` the Submit button calls) if it's already passed, before rendering anything. The client's countdown is cosmetic.
- **`CODE_SNIPPET` questions are never auto-graded.** `submitAttempt`'s grading sums `Question.points` only over `MULTIPLE_CHOICE`/`TRUE_FALSE`; a `CODE_SNIPPET` answer's `freeTextAnswer` is stored but contributes nothing to `scorePercent`. `status` still becomes `GRADED` — there is no "awaiting manual review" `AttemptStatus`. A future grading UI would query `GRADED` attempts' `Answer` rows where `Question.type = CODE_SNIPPET`.

## 4. Known gaps (schema does not model these — do not fabricate)

- **Skills / skill proficiency** — no `Skill` model. Any "skills acquired" UI needs a real field added first.
- **Real time tracking** — no session/duration log; see Learning Hours rule above.
- **Program categories** — `Program` has no category/tag field; catalog filter chips are not built.
- **"Saved" enrollment state** — My Learning's Stitch reference shows a Saved tab; no backing field exists (`EnrollmentStatus` has no SAVED value). Dropped, not faked.
- **Assessments have no curriculum entry point.** `Assessment.moduleId` hangs off `Module` directly, not off a `Lesson` — a `Lesson` with `type: QUIZ` has no FK to an `Assessment`. M4 3a built `/learn/assessments/[assessmentId]` and the attempt flow, but nothing links to it from `CurriculumAccordion` or the lesson page yet; it's only reachable by direct URL. Wiring that up needs a product decision on where the link belongs (module-level vs. replacing the `QUIZ` lesson-type row) — not assumed here.
- **Assignment-taking UI** — still unbuilt (M4 scope was assessments + certificates only, not assignments).
