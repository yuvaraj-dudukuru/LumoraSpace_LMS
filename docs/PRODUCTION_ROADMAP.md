# LumoraSpace LMS — Production Roadmap and Claude Code Prompts

Written 17 Sep 2026, after Phase A. Work top to bottom.

- **Launch-ready** means: Part 0 + Phase B + Phase C + Phase D + Phase G.
- Phases E, F and H can ship after the first cohort starts.

---

## How every phase is run (read once)

- One phase per Claude Code session. Run `/clear` before each one.
- Paste the prompt **as-is**. It never starts with `#`, `/` or `!`.
- **When a phase changes the schema**, the prompt tells Claude Code to stop after editing `schema.prisma`. You then run:
  ```powershell
  npx prisma migrate dev --name <name it gives you>
  ```
  and reply "migrated, continue".
- **Release routine** after every phase:
  1. Run the manual checklist locally.
  2. If the phase added a migration, apply it to production first. The command uses the unpooled URL:
     ```powershell
     $env:DATABASE_URL = ((Get-Content .env.neon | Select-String '^DATABASE_URL=').Line -replace '^DATABASE_URL=','').Trim('"') -replace '-pooler',''; npx prisma migrate deploy; Remove-Item Env:DATABASE_URL
     ```
  3. Add any new env vars in Vercel.
  4. `git push origin main`.
  5. Smoke-test https://lumora-space-lms.vercel.app.
- If a session hits 80% context, tell it: "commit what works, stop, report".

---

## Part 0 — Launch blockers (you, no agent)

1. **Vercel function region → Singapore.**
   - Vercel → Project → Settings → Functions → Function Region → `sin1`.
   - Why: Neon is in `ap-southeast-1` (Singapore). A new Vercel project runs its server code in Washington D.C. (`iad1`) by default.
   - Phase A measured about 30 SQL statements for `/learn`. If each crosses the Pacific, pages take seconds. This is the cheapest big speed-up you have.
2. **Vercel env vars:**
   - `APP_URL=https://lumora-space-lms.vercel.app`
   - `RESEND_API_KEY` + `EMAIL_FROM_ADDRESS` (verify the domain in Resend first)
   - `S3_*` (plus the R2 CORS rule in DEPLOYMENT.md)
   - optional: `COMMUNITY_URL` (WhatsApp/Discord invite)
   - Google OAuth redirect URI: `https://lumora-space-lms.vercel.app/api/auth/callback/google`
3. **Push:** `git push origin main`. None of the work so far adds a migration. Then check that `/login` shows "Contact your program admin".
4. **Take the template "Data Analyst" program down.** Use `prisma/set-program-status.ts` (dry run first, then `--apply`), from the earlier prompt. If that session hasn't run yet, run it before anything else.
5. **Real curriculum:**
   - Put your programs in `prisma/bootstrap-data.json` with new slugs and delete `"_template": true`.
   - Check the file: `npx tsx scripts/verify-bootstrap-data.ts`.
   - Load it with `npm run bootstrap:curriculum`, using the Neon one-liner pattern above.
   - After Phase C you'll do this in the admin UI instead.
6. **Testing:**
   - Grant Harsha access to the real program so the tester sees the full learner flow.
   - For seeded demo data, set up the Neon `staging` branch plus Vercel Preview (DEPLOYMENT.md → "Staging branch for testers").

---

## Phase B — Live sessions, notifications, and Phase A fixes

No schema change (the tables already exist).

```
Phase B — Live sessions, in-app notifications, and three fixes. Read CLAUDE.md and
docs/CONTRACTS.md. No browser tool. Plan mode once. Commit after each step and update
CONTRACTS.md in the same commit.

LiveSession, SessionAgendaItem, SessionAttendee, PreSessionQuestion, Notification and
NotificationPreference already exist in schema.prisma and the init migration. Use them as
they are. If you need a new field or index, STOP after editing DATA_MODEL.md and
schema.prisma, tell me the migration name, and wait — I run `npx prisma migrate dev`.

HARD RULE: no sample or invented data outside prisma/seed.ts.

STEP 1 — Fixes from the Phase A review
 a) Streak display is stale: User.streakDays is only written on lesson completion, so a
    learner inactive for a week still shows their old streak. Add
    effectiveStreak(streakDays, lastActiveAt, now) to src/lib/streak.ts — 0 when the last
    active calendar day (Asia/Kolkata) is before yesterday — and use it everywhere a streak
    is displayed or counted (dashboard, achievements, progress page). No-DB tests in
    verify-learner-logic.ts.
 b) A failed GRADED assessment with attempts left shows a "Not started" pill with
    "Resubmit". Add pending state "failed" (label "Not passed · N attempts left") and action
    "retry" (label "Try again"). Update pending-work, the list component, next-step if
    affected, and the verify scripts.
 c) Fix the pre-existing lint error in prisma/seed.ts. `npm run lint` must exit 0.

STEP 2 — Live sessions: admin
 /admin/sessions: list (upcoming first; filter by batch and status) plus create/edit/cancel.
 Fields: batch, host (a MENTOR assigned to that batch, or an ADMIN), title, description,
 start, end, meetingUrl (https only), agenda items (topic, minutes, order). Entered and
 shown in Asia/Kolkata, stored in UTC. end > start. Cancel sets status CANCELLED — never
 delete. Server Actions: requireRole(ADMIN) + Zod. Add "Sessions" to the admin nav.

STEP 3 — Live sessions: learner and mentor
 - getUpcomingSessions / getPastSessions scoped to batch ids (one query each).
 - /learn/sessions: upcoming and past sessions for the learner's GRANTED batches. "Join" is
   enabled only from 15 minutes before start until end (computed server-side).
   meetingUrl is sent to the browser ONLY for GRANTED learners of that batch, the host,
   and admins. Pre-session question form (PreSessionQuestion) until the start time.
 - /learn dashboard: "Upcoming support" card (next 3), and a "Join session" quick action
   while one is live. Add "Sessions" to the learner nav.
 - /mentor/sessions: sessions in the mentor's batches. The host sees pre-session questions
   and can mark them addressed. Once a session has started, an attendance form
   (SessionAttendee.present) for that batch's learners — only the host or an admin may
   submit it. Add it to the mentor nav.
 - Recent activity gains a derived "session_attended" kind (present = true).

STEP 4 — Notifications
 - src/lib/notifications.ts: createNotifications([{ userId, type, title, body, actionUrl }]).
   Never throws into the caller (log and continue, like mail.ts). One createMany.
   Type union: ACCESS_GRANTED, SUBMISSION_REVIEWED, CERTIFICATE_ISSUED, SESSION_SCHEDULED,
   SESSION_UPDATED, SESSION_CANCELLED, NEW_SUBMISSION. Map each type to exactly one
   NotificationPreference flag; no preference row = everything on.
 - Write them at the existing event sites: grantAccess, bulkGrantAccess, submitReview,
   issueCertificateIfEligible, session create/update/cancel (to the batch's GRANTED
   learners), and submitAssignment (to that batch's mentors).
 - A bell with an unread count in all three shells (one count query in each layout,
   passed down as a number). One shared list component used by /learn/notifications,
   /mentor/notifications and /admin/notifications: newest first, 20 per page, mark one or
   all read. The actions only ever touch the caller's own rows.
 - Settings: a "Notification preferences" section with the five booleans; upsert the
   caller's row. Emails respect the same preferences.

STEP 5 — Verify
 - tsc, lint, build — real output.
 - Seed: 2 sessions per ACTIVE batch (one tomorrow, one in the past with attendance) and
   a few notifications per learner.
 - verify-sessions.ts must show:
   - meetingUrl is never returned to an AWAITING learner or a learner of another batch
   - the join window works
   - a mentor can't mark attendance for another batch
   - cancelled sessions are excluded from upcoming
 - verify-notifications.ts must show:
   - each event writes exactly one row per recipient
   - preferences suppress notifications
   - mark-read can't touch another user's rows
 - Query count per new route, and a manual checklist with seeded accounts.
```

---

## Phase C — Admin content management (no more editing JSON)

```
Phase C — Admin content management. Read CLAUDE.md and docs/CONTRACTS.md. No browser tool.
Plan mode once. Commit after each step. Admin-only (requireRole(ADMIN)) for every action,
all Zod-validated. No schema change expected; if one is needed, STOP and tell me.

STEP 1 — Programs: /admin/programs list + create/edit (name, slug — unique, lowercase-dash
 — description, level, durationWeeks, format, credentialType, status). Publishing is
 blocked until the program has ≥1 PUBLISHED module with ≥1 lesson and ≥1 UPCOMING/ACTIVE
 batch; show exactly what's missing. Archive never deletes. Hard delete only for a DRAFT
 program with zero enrollments, confirmed by typing the slug. Add "Programs" to the admin
 nav.

STEP 2 — Batches (inside a program): create/edit name, code (unique), start/end
 (Asia/Kolkata input), status, capacity, scheduleNote. Show enrolled vs capacity. Status
 moves forward only: UPCOMING → ACTIVE → COMPLETED → ARCHIVED.

STEP 3 — Curriculum editor: /admin/programs/[id]/curriculum
 - Modules and lessons: add, edit, reorder with up/down buttons (no drag library).
 - Lesson editor by type:
   - VIDEO: url + duration, with a live preview. Support YouTube, Vimeo, Google Drive
     preview links and direct .mp4. Make sure the learner lesson page renders all four and
     rejects anything else with a clear message.
   - READING: markdown with preview, using the SAME sanitized renderer as the lesson page
     (add sanitization if missing).
   - QUIZ: pick an unlinked assessment from the same program.
 - Deleting a lesson that has LessonProgress rows is blocked, with an explanation.
 - After any change that adds or removes lessons, recompute progress for that program's
   enrollments through refreshEnrollmentProgress (the one rollup path) and report how many
   were updated.

STEP 4 — Assessments: create/edit settings (kind, time limit, passing %, attempts,
 shuffle, show results, status) and a question editor (MCQ / TRUE_FALSE / CODE_SNIPPET,
 options with ≥1 correct for MCQ/TF, points, explanation, reorder). Once an assessment has
 GRADED attempts, block changes to options, correctness and points (that would corrupt
 existing scores); allow only text edits, and say why in the UI.

STEP 5 — Assignments: create/edit (module, type, overview, requirements list, instruction
 steps, estimatedMins, dueAt, maxAttempts, allowGithubUrl, rubric criteria). Once any
 Review exists for the assignment, block deleting a criterion or changing maxScore.

STEP 6 — Admin reports on /admin:
 - Per batch, all derived: enrolled, average progress, ON_TRACK / BEHIND counts
   (deriveLearnerStatus), pending reviews, overdue assignments.
 - CSV export of a batch roster (name, email, progress, status, last active), built on
   the server.

STEP 7 — Docs and verify
 - DEPLOYMENT.md: the admin UI is the normal way to manage curriculum; the bootstrap
   scripts are for an empty database only.
 - verify-admin-content.ts covering every integrity block above.
 - tsc, lint, build — real output. Query counts. Manual checklist.
```

---

## Phase D — Account security and production hardening

Schema change at Step 0.

```
Phase D — Account security and production hardening. Read CLAUDE.md and docs/CONTRACTS.md.
No browser tool. Plan mode once. Commit after each step.

STEP 0 — Schema (then STOP and wait for me to migrate)
 Update DATA_MODEL.md first, then schema.prisma:
 - User.passwordChangedAt DateTime?
 - model RateLimit { key String @id, windowStart DateTime, count Int }
 Tell me the migration name and stop.

STEP 1 — Session revocation
 Put the token's issued-at time on the JWT. getCurrentUser (which already re-reads the
 user) rejects a token issued before passwordChangedAt. Set passwordChangedAt in
 changePassword, resetUserPassword and the new reset flow. Old sessions die after any
 password change.

STEP 2 — Self-service password reset
 - Pages: /forgot-password and /reset-password/[token].
 - Token: 32 random bytes, emailed via mail.ts (new template). Store only its SHA-256 hash
   in VerificationToken (identifier "reset:<userId>"). Expires in 30 minutes, single use;
   issuing a new one deletes the old ones.
 - Always show the same response whether or not the email exists.
 - Restore a "Forgot password?" link on /login. Keep the admin reset.

STEP 3 — Email verification
 On signup, email a verify link (same token mechanism, identifier "verify:<userId>",
 24 hours) that sets emailVerified. Unverified learners see a banner with "Resend link".
 Don't block enrollment. Google sign-ins count as verified.

STEP 4 — Rate limiting (DB-backed fixed window on RateLimit, one upsert per check)
 Limits:
 - login: 5 per 15 minutes per email+IP
 - signup: 5 per hour per IP
 - forgot-password and resend-verification: 3 per hour per email and per IP
 - submitAssignment and getAssignmentUploadUrl: 30 per hour per user
 IP is the first x-forwarded-for entry. Errors stay generic. Opportunistically delete
 expired rows. Tests in a verify script.

STEP 5 — Security headers (next.config.ts)
 HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy,
 and a CSP allowing: self, Google OAuth, YouTube/Vimeo/Drive frames, the S3_ENDPOINT host
 (connect-src and img-src), and Vercel Analytics. Check the headers with curl against
 `next start`. List which pages still need a browser check by me for CSP console errors.

STEP 6 — Errors and monitoring
 - @sentry/nextjs, enabled only when SENTRY_DSN is set. Scrub emails, passwords and
   tokens.
 - app/not-found.tsx and app/global-error.tsx in the existing design language.
 - @vercel/analytics in the root layout.

STEP 7 — Public site readiness
 - Metadata (title, description, Open Graph) on /, /programs and /programs/[slug].
 - app/robots.ts: disallow /learn, /mentor, /admin, /api.
 - app/sitemap.ts: home, programs, published program slugs.
 - App icons from existing brand assets.
 - /privacy and /terms pages holding a clearly marked "PLACEHOLDER — replace with your
   legal text" block. Do NOT write legal text. Add footer links to both.

STEP 8 — Performance
 If Prisma 6 supports it, enable the relationJoins preview feature and use
 relationLoadStrategy "join" in getProgramProgress, getPendingWork and the dashboard
 sub-queries. Re-measure SQL statements for /learn, /learn/progress and /mentor/learners,
 before vs after. Results must not change (all verify scripts pass).

STEP 9 — Verify and docs
 - DEPLOYMENT.md env table: SENTRY_DSN and anything else new.
 - tsc, lint, build — real output. Every verify script.
 - Manual checklist: reset flow, verify flow, rate-limit lockout, and an old session
   killed after a password change.
```

---

## Phase E — Questions, Community, Message Mentor (post-launch)

Schema change at Step 0.

```
Phase E — One discussion system for lesson Questions, Community and Message Mentor.
Read CLAUDE.md and docs/CONTRACTS.md. No browser tool. Plan mode once. Commit per step.

STEP 0 — Schema (then STOP and wait for me to migrate). DATA_MODEL.md first.
 - DiscussionThread { id, programId, batchId?, lessonId?, authorId,
   kind QUESTION|DISCUSSION|PRIVATE, title, body, status OPEN|ANSWERED|CLOSED,
   pinned, hidden, createdAt, updatedAt, lastActivityAt }
 - DiscussionPost { id, threadId, authorId, body, isAccepted, hidden, createdAt, editedAt }
 Indexes for the list queries. Tell me the migration name.

VISIBILITY (enforced in one pure predicate plus every query):
 - QUESTION and DISCUSSION: GRANTED learners of the program (or of the batch, when
   batchId is set), mentors of those batches, and admins.
 - PRIVATE: the author, mentors of the author's batch, and admins only.
 - Hidden items are never returned to learners.
 - Bodies render through the same sanitized markdown renderer, with length limits and the
   Phase D rate limiter.

STEP 1 — Queries and actions: create thread, reply, edit own post within 15 minutes,
 accept an answer (thread author or mentor), pin/hide/close (batch mentor or admin).
STEP 2 — Lesson page: a "Questions" tab listing that lesson's threads, plus "Ask a
 question".
STEP 3 — /learn/community: all non-private threads in the learner's programs.
 - Filters: kind, status, lesson, unanswered.
 - Search: Postgres ILIKE; state the limitation in the report.
 - 20 per page.
 - If COMMUNITY_URL is set, rename that external nav item to "Community chat".
STEP 4 — Message mentor: quick action on /learn and /learn/progress opens a PRIVATE
 thread; /learn/messages lists them.
STEP 5 — Mentor side:
 - /mentor/questions: unanswered first, with age, across the mentor's batches; inline
   reply.
 - An unanswered count on the mentor dashboard.
 - The learner-detail page gets a real "Questions" section.
STEP 6 — Notifications and activity:
 - Notifications: a reply notifies the thread author; a new QUESTION or PRIVATE thread
   notifies the batch mentors; an accepted answer notifies the answerer.
 - Activity kinds: question_asked, question_answered.
STEP 7 — Verify: a visibility-matrix script covering an AWAITING learner, a learner of
 another batch, another mentor, and an admin, against every query and action. Also tsc,
 lint, build, query counts and a manual checklist.
```

---

## Phase F — Reminders and shareable certificates (post-launch)

```
Phase F — Scheduled reminders and shareable certificates. Read CLAUDE.md and
docs/CONTRACTS.md. No browser tool. Plan mode once. Commit per step. No schema change
expected; if one is needed, STOP.

STEP 1 — Daily cron job
 - Route: /api/cron/daily. Reject any request without
   `Authorization: Bearer ${CRON_SECRET}`.
 - Schedule: in vercel.json, `30 3 * * *` (09:00 IST). The Hobby plan allows one run a
   day.
 - Jobs, all with batched queries (no per-user loops):
   - assignment due within 24h and not submitted → learner
   - assignment that became overdue since the last run → learner
   - session starting tomorrow → the batch's learners
   - Mondays only: learners who are BEHIND → a gentle nudge
   - pending reviews older than 3 days → a digest to each mentor
 - Idempotent: skip when the same user already has a notification with the same type and
   actionUrl in the last 20 hours.
 - Email only for due-tomorrow and session-tomorrow, via mail.ts, respecting preferences.
 - Hard cap per run. Return JSON counts. Document CRON_SECRET in DEPLOYMENT.md.

STEP 2 — Certificate PDF
 - /learn/certificates/[id]/download (owner only), plus a public download on
   /verify/[number] for VALID certificates only.
 - Generate on the server (@react-pdf/renderer or pdf-lib) in the brand style: learner
   name, program, issue date, certificate number, verify URL, and a QR code to it.
 - Revoked certificates: no download.
 - "Add to LinkedIn" button using LinkedIn's add-to-profile URL.

STEP 3 — Admin/mentor utilities: "Resend access email" on an enrollment, and "Send
 reminder" on the mentor learner-detail page (rate limited, creates a notification plus an
 email).

STEP 4 — Verify: a cron dry-run mode (?dry=1) that returns what it would send; run it
 against the seeded DB. PDF route auth checks. tsc, lint, build. Manual checklist.
```

---

## Phase G — Automated tests and CI (do before launch)

```
Phase G — CI and end-to-end tests. Read CLAUDE.md. No browser tool for your own checks
(Playwright runs headless in CI). Commit per step.

STEP 1 — .github/workflows/ci.yml
 - Triggers: pull requests and pushes to main.
 - Setup: Node 20, npm ci (cached), then prisma generate, tsc, lint, and build with dummy
   non-secret env values.
 - A postgres:16 service container, then: migrate deploy → seed → every
   scripts/verify-*.ts. Any failure fails the job.
 - No repository secrets required.

STEP 2 — Playwright E2E, run in the same workflow against `next start` on the seeded
 service DB. Add an EMAIL_TRANSPORT=log mode to mail.ts so emails are logged, not sent.
 Tests:
 - learner: log in → lesson → mark complete → percentage moves
 - an AWAITING learner is blocked from content
 - admin grants access and the learner gets in
 - mentor claims and reviews a submission, and the learner sees the feedback
 - quiz: answers persist across a reload; submit shows the score
 - public /verify page, signed out
 - forgot-password flow, reading the reset link from the log
 Upload traces and screenshots on failure.

STEP 3 — Docs I act on myself:
 - DEPLOYMENT.md: turn on GitHub branch protection (CI must pass before merge), and use
   Preview deployments on the Neon staging branch.
 - New RUNBOOK.md covering:
   - rolling back a Vercel deploy
   - restoring Neon from a point in time with a branch
   - rotating AUTH_SECRET (logs everyone out)
   - rotating Resend / R2 / Google keys
   - what to do when emails fail
   - bulk-granting a new cohort
   - archiving a finished batch

Report the real CI result from a pushed branch (paste the Actions run summary).
```

---

## Phase H — Online payments with Razorpay (only when you decide to charge online)

Settle these first:
- the price per program
- whether it includes GST
- the refund policy
- whether you need coupons
- a Razorpay account with KYC completed

```
Phase H — Razorpay payments. Read CLAUDE.md and docs/CONTRACTS.md. Plan mode once.
Commit per step. TEST-MODE keys only until I say otherwise.

STEP 0 — Schema (STOP after): Program.pricePaise Int? (null = free / admin-granted, as
 today) and Program.currency (default INR). Check that the existing Payment and
 PaymentEvent models fit: order id, payment id, amount, status, and a unique Razorpay
 event id for idempotency. Propose the changes, update DATA_MODEL.md, stop.

STEP 1 — Checkout: enrolling in a paid program creates the Enrollment (AWAITING) and a
 Razorpay order on the server. The amount always comes from the DB, never the client. Then
 Razorpay Checkout; the server verifies the payment signature.

STEP 2 — Webhook: /api/webhooks/razorpay. Verify X-Razorpay-Signature against
 RAZORPAY_WEBHOOK_SECRET. Idempotent on the event id. The webhook is the source of truth:
 payment.captured marks the Payment CAPTURED and grants access (AWAITING → GRANTED)
 through the same code path as grantAccess (notification + email). Record refunds as
 events. Free programs keep today's admin-grant flow.

STEP 3 — Receipt email. /admin/payments list with filters. The learner sees payment
 status on My Learning. Refunds happen in the Razorpay dashboard and are recorded via the
 webhook.

STEP 4 — Verify: signature verification tests, webhook replay (idempotency), amount
 tampering rejected, a free-program regression check. tsc, lint, build. DEPLOYMENT.md env
 rows (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET).
```

---

## Deliberately not planned yet

- **Coding practice with code execution.** It needs a sandboxed runner (e.g. Judge0) with real cost and security work. Revisit once a cohort asks for it; PRACTICE quizzes cover practice for now.
- **Native mobile app.** The web app is responsive; a PWA manifest can come later.
- **Multi-tenant / white-label.**
