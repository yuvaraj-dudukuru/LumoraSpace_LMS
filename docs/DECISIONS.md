# Decisions

Binding resolutions for the 20 questions raised in the original `OPEN_QUESTIONS.md` (Phase 0).
These supersede that document's guesses — the guesses are preserved there for record, but the
schema, API, and eventual implementation follow what's written here. New ambiguities raised while
applying these corrections are in the current `OPEN_QUESTIONS.md`, not here.

1. **Collapse `Course`.** The model is `Program → Module → Lesson`. No screen shows a program with more than one course, so the extra nesting level added no value — `Module.courseId` becomes `Module.programId` and `Course` is deleted.

2. **Cohort-only for MVP.** `Enrollment.programId` is required. `Enrollment.batchId` stays nullable at the DB level so self-paced enrollment is possible later, but MVP UI and seed data only ever create batch-backed enrollments.

3. **Confirmed: explicit "Mark as Complete" drives completion.** `videoProgressPercent` is a resume-position hint only and never triggers completion — matches the one screen that shows both controls.

4. **Confirmed: Quiz/Assessment unified, with a `kind` field.** `Assessment.kind: PRACTICE | GRADED` replaces inferring type from a null `passingScorePercent`, since that was implicit and fragile. Only `GRADED` assessments count toward certificate eligibility.

5. **Confirmed: Reviews means mentor grading of submissions.** Matches `reviewing_alex_morgan`/`review_submission_mobile`, not course ratings. The mentor nav item is renamed "Submissions" in the app to remove the ambiguity permanently.

6. **Drop `SessionAttendee.engagementPercent`.** Its meaning was never confirmed (live poll? follow-up quiz?) — don't persist a field nobody can specify a source for. `present` is kept.

7. **Confirmed: `MentorAssignment` stays batch-scoped.** The program-level "assigned mentors" count shown on program detail is the distinct union of mentors across that program's batches, not a separate assignment record.

8. **Mentor access to batch detail is read-only, scoped to their own batches.** Admins get full access. Resolves the ambiguous `batch_detail_mobile` role by giving mentors a real (if limited) use for the screen instead of guessing it's admin-only.

9. **Confirmed: shared account settings for any signed-in user.** `settings_mobile_1`'s generic menu and the learner settings screens serve any role via the same endpoints.

10. **Confirmed: `/verify/[certificateNumber]` is public, logged-out, and minimal.** It renders only learner name, program name, issue date, and status. Never email, never user id, never batch internals — this is the one route unauthenticated users hit directly, so it gets the strictest field allowlist in the API.

11. **Confirmed: Stitch inconsistency.** The marketing-shell wrapping on some authenticated desktop screens (e.g. `course_overview_full_stack_developer`, `my_learning_lumoraspace`) is a design-pass artifact, not intentional. The sidebar-nav shell (`student_dashboard_home`-style) is canonical for every authenticated page.

12. **Confirmed: `student_progress` and `student_progress_lumoraspace` are the same feature.** The sidebar-nav layout (`student_progress`) is canonical; the marketing-shell variant is discarded, not built as a second route.

13. **Changed: all admin settings screens deferred to Phase 2.** There is no settings IA to reconcile because MVP ships none of it — `settings_general_lumoraspace_admin`, `settings_integrations_lumoraspace_admin`, and `settings_roles_permissions_lumoraspace_admin` (three mutually inconsistent navs) are cut wholesale rather than partially reconciled. `/admin/settings/*` is removed from `API.md`.

14. **Confirmed: cut "External Auditor" and custom roles.** `Role` stays exactly `LEARNER | MENTOR | ADMIN` for MVP; the custom-roles UI on the roles/permissions screen is Phase 2 (and moot anyway per #13).

15. **Confirmed: public signup always creates `LEARNER`.** Mentor and Admin accounts are provisioned only via an admin "Add User"/"Add Mentor" action, never self-registered — matches `sign_up_lumoraspace` having no role selector.

16. **Confirmed: no standalone learner resources page in MVP.** `resources_lumoraspace`/`resources_mobile` stay mentor-facing only; learners only see resources embedded in a lesson or assignment.

17. **Confirmed: Community links are hardcoded app config.** No admin screen manages them, and Community is Phase 2 regardless, so there's no CRUD gap to fill.

18. **Confirmed: `Batch.scheduleNote` stays free text.** No screen shows a structured recurrence editor, so a structured schedule model would be pure invention.

19. **Confirmed: `Payment.method` stays a string.** Values look like gateway-provided display strings, not a fixed taxonomy — consistent with stubbing the payment gateway for MVP.

20. **Confirmed: `Certificate.templateName` string is sufficient.** No screen shows real template management beyond a stat count; a separate `CertificateTemplate` model would be speculative for MVP.
