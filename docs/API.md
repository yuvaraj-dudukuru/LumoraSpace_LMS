# API Surface

Per the stack decision, reads are Server Components querying Prisma directly (no separate GET endpoint needed in most cases) and writes are Server Actions. The table below still lists every operation as `METHOD path` for clarity/portability — treat `GET` rows as "data a Server Component loads" and non-`GET` rows as "a Server Action" unless the app later needs a public JSON API (e.g. a mobile client), in which case these same shapes become route handlers under `/api`.

Auth roles: `PUBLIC` (no session), `LEARNER`, `MENTOR`, `ADMIN`, `ANY` (any signed-in role). Every non-`GET` action re-validates the caller's role server-side regardless of what the client sends (see CLAUDE.md constraints).

Reconciled against `DATA_MODEL.md` post-`DECISIONS.md`: `Course`-scoped paths/shapes are renamed to `Program`, rubric grading matches the `RubricCriterion`/`RubricScore` split, and every endpoint whose only backing model is `// PHASE 2` is removed and left as a one-line pointer rather than silently dropped — the model stays in the schema for a later phase, so the future surface stays documented. Phase-2 screens are: `community`, `practice_hub`, `analytics`, `payments`, `resources` (mentor library), `sessions`, `notifications`, all `settings` sub-pages, `assessment_builder`, every `*_mobile` variant as its own route.

## Auth & Onboarding

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `POST /auth/signup` | PUBLIC | `{ name, email, password }` | `{ userId }` + session cookie | sign_up_lumoraspace |
| `POST /auth/login` | PUBLIC | `{ email, password }` \| Google OAuth | session cookie | login_lumoraspace |
| `POST /auth/logout` | ANY | — | 204 | (nav logout actions) |
| `PATCH /onboarding/goal` | LEARNER | `{ learningGoal }` | `{ ok }` | onboarding_learning_goal |
| `PATCH /onboarding/experience-level` | LEARNER | `{ experienceLevel }` | `{ ok }` | onboarding_experience_level |
| `POST /onboarding/complete` | LEARNER | — | `{ ok }` | onboarding_welcome, onboarding_success |

`POST /onboarding/complete` no longer returns an enrolled program — see gap #2 below: nothing in the onboarding flow captures which `Program`/`Batch` to enroll into (that now happens via `POST /programs/:id/enroll`), so onboarding only marks `User.onboardingComplete`. `onboarding_success`'s "enrolled-course name" display is only valid once the learner has actually enrolled through the catalog — sequencing is a new open question (`OPEN_QUESTIONS.md` #2).

## Public marketing & catalog

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /` | PUBLIC | — | landing content (static + featured programs) | lumoraspace_landing_page |
| `GET /programs` | PUBLIC | `?category=&q=` | `Program[]` (card fields) | explore_programs |
| `GET /programs/:slug` | PUBLIC | — | `Program` + outcomes + curriculum summary + price | program_details_full_stack_developer |
| `POST /programs/:id/enroll` | LEARNER | `{ batchId }` | new `Enrollment` | program_details_full_stack_developer "Enroll Now" CTA — **gap #2, added by audit**: no screen showed this write, but the CTA exists and nothing else creates an `Enrollment` |
| `GET /verify/:certificateNumber` | PUBLIC | — | `{ learnerName, programName, issuedAt, status }` or 404 | certificate verification (public-facing counterpart of certificate_detail_lum_2026_00124) — field list is exhaustive per `DECISIONS.md` Q10, never email/userId/batch internals |

`lumoraspace_home` removed from this section — **gap #1, fixed by audit**: `SCREEN_INVENTORY.md` marks it LEARNER, not PUBLIC (it's a learner dashboard, not the marketing landing page), so it was mismapped onto `GET /`. It's a near-duplicate of `student_dashboard_home` and now lives only under `GET /learn` below; which layout is canonical is a new open question (`OPEN_QUESTIONS.md` #1).

## Learner — dashboard, learning, progress

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /learn` | LEARNER | — | greeting, current course, next step, upcoming items, streak, recent activity | student_dashboard_home, lumoraspace_home (near-duplicate layout, see gap #1) |
| `GET /learn/my-programs` | LEARNER | `?filter=in_progress\|completed\|saved` | `Enrollment[]` with program + progress | my_learning_lumoraspace |
| `GET /learn/programs/:programId` | LEARNER | — | program detail + module/lesson tree + progress | course_overview_full_stack_developer, course_curriculum |
| `GET /learn/lessons/:lessonId` | LEARNER | — | lesson content, resources, sibling nav, existing notes | lesson_experience_middleware_security, lesson_experience_mobile |
| `POST /learn/lessons/:lessonId/complete` | LEARNER | — | updated `LessonProgress` + rolled-up `Enrollment.progressPercent` | lesson_experience_* "Mark as Complete" |
| `PATCH /learn/lessons/:lessonId/notes` | LEARNER | `{ notes }` | `{ ok }` | lesson_experience_middleware_security |
| `GET /learn/progress` | LEARNER | — | stats, weekly activity, skills, certificates, next milestone | student_progress (canonical per `DECISIONS.md` Q12), student_progress_mobile |

`GET /learn/courses/:courseId` and `GET /learn/my-courses` renamed above (`:courseId`→`:programId`, "course"→"program" in shapes) — `Course` no longer exists as a model per `DECISIONS.md` Q1. `student_progress_lumoraspace` dropped per Q12 (discarded marketing-shell duplicate, not a second route).

## Learner — quizzes and assignments

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `POST /assessments/:id/attempts` | LEARNER | — | new `Attempt` (or resume existing), scoped to caller's `Enrollment` | quiz_interface_* "Start Quiz" |
| `GET /attempts/:attemptId` | LEARNER | — | question set (shuffled if configured) + saved answers | quiz_interface_sql_fundamentals_assessment |
| `PUT /attempts/:attemptId/answers/:questionId` | LEARNER | `{ selectedOptionId? , freeTextAnswer?, flagged? }` | `{ ok }` | autosave per question (prompt-pack requirement) |
| `POST /attempts/:attemptId/submit` | LEARNER | — | `{ scorePercent, passed }` | Submit Assessment action |
| `GET /assignments/:id` | LEARNER | — | assignment detail, requirements, resources, rubric criteria, existing submission | assignment_details_mobile, assignment_details_sql_optimization |
| `POST /assignments/:id/submissions` | LEARNER | `{ fileUrl?, githubUrl?, notes? }` | new/updated `Submission`, scoped to caller's `Enrollment` | assignment submit actions |
| `GET /submissions/:id/feedback` | LEARNER | — | `Review` + `rubricScores` (joined to their `RubricCriterion`) + overall score | assignment_feedback_data_cleaning_assignment, assignment_feedback_mobile |

`GET /practice` (practice hub) removed — Phase 2, see `DATA_MODEL.md`. **Gap #5, flagged by audit, not fixed:** none of `assignment_details_*` / `assignment_feedback_*` are in the 16-screen MVP "In" list, yet `review submission` (mentor grading) is — a mentor has nothing to review unless a learner-facing submission flow also ships. These endpoints are kept because `review submission` structurally depends on them; whether the screens themselves are in or out of MVP scope is a new open question (`OPEN_QUESTIONS.md` #3).

## Certificates (learner-facing)

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /certificates` | LEARNER | — | `Certificate[]` earned | student_progress "Recent Certificates" |
| `GET /certificates/:id` | LEARNER | — | certificate detail + download link | certificates list detail views |
| `GET /certificates/:id/download` | LEARNER | — | PDF stream | download-PDF actions |

## Account settings (any signed-in role)

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /settings/profile` | ANY | — | name, email, avatar, bio | settings_profile_desktop |
| `PATCH /settings/profile` | ANY | `{ name?, bio?, avatarUrl? }` | updated fields | Save Changes |
| `PATCH /settings/security/password` | ANY | `{ currentPassword, newPassword }` | `{ ok }` | settings_security_desktop |
| `PATCH /settings/security/2fa` | ANY | `{ enabled }` | `{ ok }` | settings_security_desktop |
| `DELETE /settings/account` | ANY | `{ confirm: true }` | 204 + session revoked | "Delete Account" |

`settings_mobile_1` (generic menu) reuses these endpoints per `DECISIONS.md` Q9. `GET /community` and `GET/PATCH /settings/notifications` removed — Phase 2 (`Notification`/`NotificationPreference` models), see `DATA_MODEL.md`.

## Mentor

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /mentor` | MENTOR | — | needs-attention counts, pending reviews, at-risk learners, activity feed | mentor_dashboard_desktop, mentor_dashboard_mobile |
| `GET /mentor/learners` | MENTOR | `?status=&q=` | roster with progress/status | learners_lumoraspace, learners_mobile |
| `GET /mentor/learners/:id` | MENTOR | — | learner detail, pending work, activity, questions | learner_detail_sarah_jenkins, learner_detail_mobile |
| `GET /mentor/programs` | MENTOR | `?tab=assigned\|all\|drafts` | assigned program list | courses_lumoraspace, courses_mobile, course_detail_forge_data_analyst, course_detail_mobile |
| `GET /mentor/reviews` | MENTOR | `?status=` | review queue (nav item "Submissions" per `DECISIONS.md` Q5) | reviews_lumoraspace, reviews_mobile |
| `GET /mentor/reviews/:submissionId` | MENTOR | — | submission files, code, `Assignment.rubricCriteria`, requirements | reviewing_alex_morgan, review_submission_mobile |
| `POST /mentor/reviews/:submissionId` | MENTOR | `{ rubricScores: [{ criterionId, score }], overallFeedback, outcome }` | new `Review` + `RubricScore[]` | Approve & Send Feedback / Request Revision / Save Draft |
| `GET /mentor/batches/:id` | MENTOR | — | read-only batch detail, own assignment only | batch_detail_mobile (`DECISIONS.md` Q8) |

Request body for `POST /mentor/reviews/:submissionId` changed per `DATA_MODEL.md` FIX B: `rubricScores` now references the assignment's fixed `RubricCriterion` rows instead of freeform criteria. `GET/POST /mentor/sessions*` and `GET /mentor/resources` removed — Phase 2 (`Session`/`SessionAgendaItem`/`SessionAttendee`/`PreSessionQuestion`/`Resource`), see `DATA_MODEL.md`.

## Admin — dashboard

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /admin` | ADMIN | `?range=7d\|30d\|90d` | KPI tiles, needs-attention, enrollment/activity charts, recent activity | admin_dashboard_desktop, admin_dashboard_mobile |

`GET /admin/analytics` and `GET /admin/analytics/export` removed — analytics is explicitly Phase 2 per the MVP cut, independent of any single model.

## Admin — programs, curriculum, batches, enrollments, users, mentors

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /admin/programs` | ADMIN | `?status=&q=` | `Program[]` w/ counts | programs_lumoraspace_admin, programs_mobile |
| `POST /admin/programs` | ADMIN | `Program` fields | new `Program` | "Create Program" |
| `GET /admin/programs/:id` | ADMIN | — | full detail across tabs (curriculum/batches/enrollments/mentors) | program_detail_forge_data_analyst_desktop/mobile |
| `PATCH /admin/programs/:id` | ADMIN | partial `Program` | updated `Program` | Edit Program |
| `POST /admin/programs/:id/archive` \| `/unpublish` | ADMIN | — | `{ ok }` | Archive / Unpublish |
| `GET/PATCH /admin/programs/:id/curriculum` | ADMIN | module/lesson tree edits | updated tree | curriculum_lumoraspace_admin, curriculum_mobile |
| `GET /admin/batches` | ADMIN | `?status=&program=&q=` | `Batch[]` | batches_lumoraspace_admin, batches_mobile |
| `POST /admin/batches` | ADMIN | `{ programId, name, startDate, endDate, capacity }` | new `Batch` | "Create Batch" |
| `GET /admin/batches/:id` | ADMIN | — | stats, learners, mentors (full access, vs. mentor's read-only view above) | batch_detail_forge_data_analyst_batch_04 |
| `PATCH /admin/batches/:id` | ADMIN | partial `Batch` | updated `Batch` | Edit Batch / Start Batch |
| `GET /admin/enrollments` | ADMIN | `?status=&q=` | `Enrollment[]` joined w/ learner+program+batch | enrollments_lumoraspace_admin, enrollments_mobile |
| `PATCH /admin/enrollments/:id` | ADMIN | `{ status?, accessState? }` | updated `Enrollment` | Suspend/Grant access |
| `GET /admin/users` | ADMIN | `?role=&q=` | `User[]` w/ role/status/last active | users_lumoraspace, users_mobile |
| `POST /admin/users` | ADMIN | `{ name, email, role }` | new `User` (invite) | "Add User" |
| `GET /admin/mentors` | ADMIN | `?status=&q=` | mentor roster w/ workload | mentors_lumoraspace_admin, mentors_mobile |
| `POST /admin/mentors` | ADMIN | `{ userId or new-user fields }` | new mentor | "Add Mentor" |
| `POST /admin/batches/:id/mentors` | ADMIN | `{ mentorId, roleLabel }` | new `MentorAssignment` | "Manage Mentors" / "Assign Mentor" |

**Gap #4, flagged by audit, not fixed:** the MVP-16 bullet reads "admin programs/batches/learners/enrollments," but `SCREEN_INVENTORY.md` marks `learners_lumoraspace`/`learner_detail_sarah_jenkins` MENTOR, not ADMIN — there is no literal admin "learners" screen. That roster is already covered by `GET /mentor/learners*` above; admin's cross-role equivalent is `GET/POST /admin/users`. Naming mismatch only, nothing missing.

## Admin — certificates

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /admin/certificates` | ADMIN | `?status=&program=&q=` | issued list + template | certificates_lumoraspace_admin, certificates_mobile, issued_certificates_lumoraspace_admin |
| `GET /admin/certificates/:id` | ADMIN | — | certificate detail + history/audit log + template | certificate_detail_lum_2026_00124 — **gap #3, added by audit**: only list + revoke existed, nothing addressed the single-record detail+history view this screen needs |
| `PATCH /admin/certificates/:id/revoke` | ADMIN | `{ reason }` | updated `Certificate` | "Revoke Certificate" |

`PATCH /admin/certificates/eligibility` removed — Phase 2 (`CertificateEligibilityRule`), see `DATA_MODEL.md`. `GET/PUT /admin/assessments*` (assessment builder) and all `/admin/payments*` and `/admin/settings/*` removed — Phase 2 per the MVP cut / `DECISIONS.md` Q13, see `DATA_MODEL.md`.
