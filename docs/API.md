# API Surface

Per the stack decision, reads are Server Components querying Prisma directly (no separate GET endpoint needed in most cases) and writes are Server Actions. The table below still lists every operation as `METHOD path` for clarity/portability — treat `GET` rows as "data a Server Component loads" and non-`GET` rows as "a Server Action" unless the app later needs a public JSON API (e.g. a mobile client), in which case these same shapes become route handlers under `/api`.

Auth roles: `PUBLIC` (no session), `LEARNER`, `MENTOR`, `ADMIN`, `ANY` (any signed-in role). Every non-`GET` action re-validates the caller's role server-side regardless of what the client sends (see CLAUDE.md constraints).

## Auth & Onboarding

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `POST /auth/signup` | PUBLIC | `{ name, email, password }` | `{ userId }` + session cookie | sign_up_lumoraspace |
| `POST /auth/login` | PUBLIC | `{ email, password }` \| Google OAuth | session cookie | login_lumoraspace |
| `POST /auth/logout` | ANY | — | 204 | (nav logout actions) |
| `PATCH /onboarding/goal` | LEARNER | `{ learningGoal }` | `{ ok }` | onboarding_learning_goal |
| `PATCH /onboarding/experience-level` | LEARNER | `{ experienceLevel }` | `{ ok }` | onboarding_experience_level |
| `POST /onboarding/complete` | LEARNER | — | `{ enrolledCourse }` | onboarding_welcome, onboarding_success |

## Public marketing & catalog

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /` | PUBLIC | — | landing content (static + featured programs) | lumoraspace_landing_page, lumoraspace_home |
| `GET /programs` | PUBLIC | `?category=&q=` | `Program[]` (card fields) | explore_programs |
| `GET /programs/:slug` | PUBLIC | — | `Program` + outcomes + curriculum summary + price | program_details_full_stack_developer |
| `GET /verify/:certificateNumber` | PUBLIC | — | `{ learnerName, programName, issuedAt, status }` or 404 | certificate verification (public-facing counterpart of certificate_detail_lum_2026_00124) |

## Learner — dashboard, learning, progress

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /learn` | LEARNER | — | greeting, current course, next step, upcoming items, streak, recent activity | student_dashboard_home, lumoraspace_home |
| `GET /learn/my-courses` | LEARNER | `?filter=in_progress\|completed\|saved` | `Enrollment[]` with course + progress | my_learning_lumoraspace |
| `GET /learn/courses/:courseId` | LEARNER | — | course detail + module/lesson tree + progress | course_overview_full_stack_developer, course_curriculum |
| `GET /learn/lessons/:lessonId` | LEARNER | — | lesson content, resources, sibling nav, existing notes | lesson_experience_middleware_security, lesson_experience_mobile |
| `POST /learn/lessons/:lessonId/complete` | LEARNER | — | updated `LessonProgress` + rolled-up `Enrollment.progressPercent` | lesson_experience_* "Mark as Complete" |
| `PATCH /learn/lessons/:lessonId/notes` | LEARNER | `{ notes }` | `{ ok }` | lesson_experience_middleware_security |
| `GET /learn/progress` | LEARNER | — | stats, weekly activity, skills, certificates, next milestone | student_progress, student_progress_lumoraspace, student_progress_mobile |

## Learner — practice, quizzes, assessments, assignments

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /practice` | LEARNER | `?type=quiz\|assignment\|assessment` | activity list w/ status | practice_hub_lumoraspace, practice_hub_mobile |
| `POST /assessments/:id/attempts` | LEARNER | — | new `Attempt` (or resume existing) | quiz_interface_* "Start Quiz" |
| `GET /attempts/:attemptId` | LEARNER | — | question set (shuffled if configured) + saved answers | quiz_interface_sql_fundamentals_assessment |
| `PUT /attempts/:attemptId/answers/:questionId` | LEARNER | `{ selectedOptionId? , freeTextAnswer?, flagged? }` | `{ ok }` | autosave per question (prompt-pack requirement) |
| `POST /attempts/:attemptId/submit` | LEARNER | — | `{ scorePercent, passed }` | Submit Assessment action |
| `GET /assignments/:id` | LEARNER | — | assignment detail, requirements, resources, existing submission | assignment_details_mobile, assignment_details_sql_optimization |
| `POST /assignments/:id/submissions` | LEARNER | `{ fileUrl?, githubUrl?, notes? }` | new/updated `Submission` | assignment submit actions |
| `GET /submissions/:id/feedback` | LEARNER | — | `Review` + rubric + score | assignment_feedback_data_cleaning_assignment, assignment_feedback_mobile |

## Certificates (learner-facing)

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /certificates` | LEARNER | — | `Certificate[]` earned | student_progress "Recent Certificates" |
| `GET /certificates/:id` | LEARNER | — | certificate detail + download link | certificates list detail views |
| `GET /certificates/:id/download` | LEARNER | — | PDF stream | download-PDF actions |

## Community, notifications, settings (learner)

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /community` | LEARNER | — | static Discord/Telegram links + guidelines (no DB) | community_lumoraspace, community_mobile |
| `GET /notifications` | LEARNER | `?filter=` | `Notification[]` | notifications_lumoraspace, notifications_mobile |
| `POST /notifications/mark-all-read` | LEARNER | — | `{ ok }` | "Mark all as read" |
| `GET /settings/profile` | ANY | — | name, email, avatar, bio | settings_profile_desktop |
| `PATCH /settings/profile` | ANY | `{ name?, bio?, avatarUrl? }` | updated fields | Save Changes |
| `GET/PATCH /settings/notifications` | ANY | `{ courseUpdates, assignmentReminders, ... }` | `NotificationPreference` | settings_notifications_desktop |
| `PATCH /settings/security/password` | ANY | `{ currentPassword, newPassword }` | `{ ok }` | settings_security_desktop |
| `PATCH /settings/security/2fa` | ANY | `{ enabled }` | `{ ok }` | settings_security_desktop |
| `DELETE /settings/account` | ANY | `{ confirm: true }` | 204 + session revoked | "Delete Account" |

## Mentor

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /mentor` | MENTOR | — | needs-attention counts, pending reviews, at-risk learners, activity feed | mentor_dashboard_desktop, mentor_dashboard_mobile |
| `GET /mentor/learners` | MENTOR | `?status=&q=` | roster with progress/status | learners_lumoraspace, learners_mobile |
| `GET /mentor/learners/:id` | MENTOR | — | learner detail, pending work, activity, questions | learner_detail_sarah_jenkins, learner_detail_mobile |
| `GET /mentor/courses` | MENTOR | `?tab=assigned\|all\|drafts` | assigned course/program list | courses_lumoraspace, courses_mobile, course_detail_forge_data_analyst, course_detail_mobile |
| `GET /mentor/reviews` | MENTOR | `?status=` | review queue | reviews_lumoraspace, reviews_mobile |
| `GET /mentor/reviews/:submissionId` | MENTOR | — | submission files, code, rubric, requirements | reviewing_alex_morgan, review_submission_mobile |
| `POST /mentor/reviews/:submissionId` | MENTOR | `{ rubricScores[], overallFeedback, outcome }` | new `Review` | Approve & Send Feedback / Request Revision / Save Draft |
| `GET /mentor/sessions` | MENTOR | `?tab=upcoming\|past` | `Session[]` | sessions_lumoraspace, sessions_mobile |
| `POST /mentor/sessions` | MENTOR | `{ title, batchId, startTime, endTime, agenda[] }` | new `Session` | "New Session" |
| `GET /mentor/sessions/:id` | MENTOR | — | agenda, pre-session questions, attendee list | session_detail_sql_q_a, session_detail_mobile |
| `PATCH /mentor/sessions/:id/attendance` | MENTOR | `{ userId, present }[]` | `{ ok }` | "Mark All Present" |
| `PATCH /mentor/sessions/:id/questions/:qId` | MENTOR | `{ addressed: true }` | `{ ok }` | "Mark as addressed" |
| `GET /mentor/resources` | MENTOR | `?type=&q=` | `Resource[]` | resources_lumoraspace, resources_mobile |

## Admin — dashboard & analytics

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /admin` | ADMIN | `?range=7d\|30d\|90d` | KPI tiles, needs-attention, enrollment/activity charts, recent activity | admin_dashboard_desktop, admin_dashboard_mobile |
| `GET /admin/analytics` | ADMIN | `?tab=&range=` | funnel, learner activity chart, program performance table | analytics_lumoraspace_admin, analytics_mobile |
| `GET /admin/analytics/export` | ADMIN | `?range=` | CSV/PDF stream | "Export Report" |

## Admin — programs, curriculum, batches, enrollments, users, mentors

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /admin/programs` | ADMIN | `?status=&q=` | `Program[]` w/ counts | programs_lumoraspace_admin, programs_mobile |
| `POST /admin/programs` | ADMIN | `Program` fields | new `Program` | "Create Program" |
| `GET /admin/programs/:id` | ADMIN | — | full detail across tabs (curriculum/batches/enrollments/mentors/assessments/certificates) | program_detail_forge_data_analyst_desktop/mobile |
| `PATCH /admin/programs/:id` | ADMIN | partial `Program` | updated `Program` | Edit Program |
| `POST /admin/programs/:id/archive` \| `/unpublish` | ADMIN | — | `{ ok }` | Archive / Unpublish |
| `GET/PATCH /admin/programs/:id/curriculum` | ADMIN | module/lesson tree edits | updated tree | curriculum_lumoraspace_admin, curriculum_mobile |
| `GET /admin/batches` | ADMIN | `?status=&program=&q=` | `Batch[]` | batches_lumoraspace_admin, batches_mobile |
| `POST /admin/batches` | ADMIN | `{ programId, name, startDate, endDate, capacity }` | new `Batch` | "Create Batch" |
| `GET /admin/batches/:id` | ADMIN | — | stats, learners, mentors | batch_detail_forge_data_analyst_batch_04, batch_detail_mobile |
| `PATCH /admin/batches/:id` | ADMIN | partial `Batch` | updated `Batch` | Edit Batch / Start Batch |
| `GET /admin/enrollments` | ADMIN | `?status=&q=` | `Enrollment[]` joined w/ learner+program+batch | enrollments_lumoraspace_admin, enrollments_mobile |
| `PATCH /admin/enrollments/:id` | ADMIN | `{ status?, accessState? }` | updated `Enrollment` | Suspend/Grant access |
| `GET /admin/users` | ADMIN | `?role=&q=` | `User[]` w/ role/status/last active | users_lumoraspace, users_mobile |
| `POST /admin/users` | ADMIN | `{ name, email, role }` | new `User` (invite) | "Add User" |
| `GET /admin/mentors` | ADMIN | `?status=&q=` | mentor roster w/ workload | mentors_lumoraspace_admin, mentors_mobile |
| `POST /admin/mentors` | ADMIN | `{ userId or new-user fields }` | new mentor | "Add Mentor" |
| `POST /admin/batches/:id/mentors` | ADMIN | `{ mentorId, roleLabel }` | new `MentorAssignment` | "Manage Mentors" / "Assign Mentor" |

## Admin — assessments, certificates, payments, settings

| Method & path | Role | Request | Response | Screens |
|---|---|---|---|---|
| `GET /admin/assessments` | ADMIN | `?status=&program=&q=` | `Assessment[]` w/ counts | assessments_lumoraspace_admin, assessments_mobile |
| `GET /admin/assessments/:id` | ADMIN | — | question bank + settings | assessment_builder_sql_fundamentals_assessment, edit_assessment_mobile |
| `PUT /admin/assessments/:id` | ADMIN | questions[], settings | updated `Assessment` | Save Draft / Publish |
| `GET /admin/certificates` | ADMIN | `?status=&program=&q=` | issued list + eligibility rules + template | certificates_lumoraspace_admin, certificates_mobile, issued_certificates_lumoraspace_admin |
| `PATCH /admin/certificates/:id/revoke` | ADMIN | `{ reason }` | updated `Certificate` | "Revoke Certificate" |
| `PATCH /admin/certificates/eligibility` | ADMIN | `CertificateEligibilityRule[]` | updated rules | "Add Requirement" |
| `GET /admin/payments` | ADMIN | `?status=&range=&q=` | `Payment[]` + revenue stats | payments_lumoraspace_admin, payments_mobile |
| `GET /admin/payments/:id` | ADMIN | — | payment detail + timeline + related enrollment | payment_detail_txn_2026_00124, payment_details_mobile |
| `POST /admin/payments/:id/refund` | ADMIN | — | updated `Payment` | "Refund Payment" |
| `GET/PATCH /admin/settings/general` | ADMIN | platform fields | `PlatformSetting` | settings_general_lumoraspace_admin, settings_mobile_2 |
| `GET/PATCH /admin/settings/integrations` | ADMIN | `{ service, config }` | `IntegrationConnection` | settings_integrations_lumoraspace_admin |
| `GET /admin/settings/roles` | ADMIN | — | role table (informational in MVP — see OPEN_QUESTIONS.md) | settings_roles_permissions_lumoraspace_admin |

Settings screens `settings_mobile_1` (generic menu), `settings_notifications_desktop`/`settings_profile_desktop`/`settings_security_desktop` (learner) reuse the "Settings (learner)" endpoints above regardless of role, since the same account settings apply to any signed-in user.
