# Data Model

Derived field-by-field from `SCREEN_INVENTORY.md` (all 91 screens). Domain is a **cohort bootcamp**: `Program` → `Module` → `Lesson`, with `Batch` as a dated cohort instance of a `Program` that learners enroll into. Roles: `LEARNER`, `MENTOR`, `ADMIN`. Binding decisions locked in `DECISIONS.md` are applied throughout — see that file for rationale.

Note on Program vs Course (resolved, `DECISIONS.md` Q1): no screen ever shows a program containing more than one course — "Forge Full Stack Developer" is a *course* card on `my_learning_lumoraspace` and a *program* on `program_detail_forge_data_analyst_desktop` interchangeably. `Course` has been collapsed out entirely; `Module` now belongs directly to `Program`.

Models marked `// PHASE 2` are kept in the schema (and the initial migration — migrations are cheap) but get no seed data, no API endpoints, and no UI in the 16-screen MVP.

```prisma
// ── Identity & Auth ──────────────────────────────────────────────
// Auth.js v5 owns Account/Session/VerificationToken via its Prisma
// adapter (standard tables, not derived from any screen — omitted
// here). User itself is extended with the fields every screen reads.

enum Role {
  LEARNER
  MENTOR
  ADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
}

enum ExperienceLevel {
  BEGINNER
  SOME_EXPERIENCE
  INTERMEDIATE
  ADVANCED
}

model User {
  id                 String            @id @default(cuid())
  name               String
  email              String            @unique
  passwordHash       String?           // null for OAuth-only accounts
  avatarUrl          String?
  role               Role              @default(LEARNER)
  status             UserStatus        @default(ACTIVE)
  title              String?           // mentor's displayed title, e.g. "Lead Instructor" (mentors_lumoraspace_admin, learner_detail_sarah_jenkins)
  bio                String?           // settings_profile_desktop
  streakDays         Int               @default(0) // student_dashboard_home "10-Day Streak", community_lumoraspace "12 Day Streak"
  experienceLevel    ExperienceLevel?  // onboarding_experience_level
  learningGoal       String?           // onboarding_learning_goal (free-form goal key, e.g. "build-skills")
  onboardingComplete Boolean           @default(false)
  twoFactorEnabled   Boolean           @default(false) // settings_security_desktop
  lastActiveAt       DateTime?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  enrollments        Enrollment[]      // lesson progress, attempts, submissions all hang off Enrollment now — FIX A
  mentorAssignments  MentorAssignment[]
  hostedSessions     Session[]         @relation("SessionHost") // PHASE 2
  attendances        SessionAttendee[] // PHASE 2
  preSessionQuestions PreSessionQuestion[] // PHASE 2
  reviewsGiven       Review[]          @relation("ReviewedBy")
  certificates       Certificate[]
  payments           Payment[]         // PHASE 2
  notifications      Notification[]    // PHASE 2
  notificationPref   NotificationPreference? // PHASE 2
}

// ── Curriculum ───────────────────────────────────────────────────

enum ContentStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum ProgramLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
}

enum ProgramFormat {
  ONLINE
  HYBRID
}

model Program {
  id              String        @id @default(cuid())
  name            String
  slug            String        @unique
  description     String
  level           ProgramLevel
  durationWeeks   Int
  format          ProgramFormat @default(ONLINE)
  credentialType  String?       // "Professional Certificate" (program_details_full_stack_developer)
  price           Decimal?      @db.Decimal(10, 2) // stubbed in MVP; explore_programs/program_details show price on public pages only
  heroImageUrl    String?
  status          ContentStatus @default(DRAFT)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  modules         Module[]
  batches         Batch[]
  enrollments     Enrollment[]
  outcomes        ProgramOutcome[]      // "what you'll learn" tiles
  eligibilityRules CertificateEligibilityRule[] // PHASE 2
  certificates    Certificate[]
}

model ProgramOutcome {
  id          String   @id @default(cuid())
  programId   String
  program     Program  @relation(fields: [programId], references: [id], onDelete: Cascade)
  icon        String
  title       String
  description String
  order       Int
}

// DECISIONS.md Q1 — Course deleted; Module hangs directly off Program.
model Module {
  id                    String        @id @default(cuid())
  programId             String
  program               Program       @relation(fields: [programId], references: [id], onDelete: Cascade)
  title                 String
  description           String?
  order                 Int
  estimatedDurationMins Int?
  status                ContentStatus @default(DRAFT) // curriculum_lumoraspace_admin publish toggle

  lessons               Lesson[]
  assessments           Assessment[]
  assignments           Assignment[]
  resources             Resource[]    // PHASE 2 — module-level downloadable materials
}

enum LessonType {
  VIDEO
  READING
  QUIZ
}

model Lesson {
  id            String        @id @default(cuid())
  moduleId      String
  module        Module        @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  title         String
  type          LessonType
  order         Int
  durationMins  Int?
  videoUrl      String?       // MVP: unlisted YouTube/Vimeo embed URL
  bodyContent   String?       // reading-type lesson content (markdown)
  description   String?

  progress      LessonProgress[]
  resources     Resource[]
}

// Learner ↔ Lesson completion + notes + per-lesson autosaved notes
// (lesson_experience_middleware_security note-taking panel)
// FIX A — scoped to the Enrollment, not the User: a User-keyed row bled
// progress across enrollments (e.g. a learner repeating a batch, or two
// programs sharing a lesson), so Enrollment.progressPercent couldn't be
// computed correctly. Reach the learner via enrollment.user.
model LessonProgress {
  id                  String     @id @default(cuid())
  enrollmentId        String
  enrollment          Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  lessonId            String
  lesson              Lesson     @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completed           Boolean    @default(false)
  completedAt         DateTime?
  videoProgressPercent Int?      // resume-position hint only — DECISIONS.md Q3, never triggers completion
  notes               String?
  updatedAt           DateTime   @updatedAt

  @@unique([enrollmentId, lessonId])
}

enum ResourceType {
  PDF
  CSV
  DOC
  ZIP
  LINK
  CODE
  VIDEO
}

// PHASE 2
// Downloadable materials attached at module or lesson level.
// FIX C — the previous version had four nullable FK columns but only
// `lessonId` had a declared relation, so `programId`/`courseId` had no
// referential integrity and Course no longer exists to scope against
// anyway. Scoped to lessonId/moduleId only, both with real relations.
model Resource {
  id         String        @id @default(cuid())
  title      String
  fileUrl    String
  fileType   ResourceType
  fileSizeKB Int?
  moduleId   String?
  module     Module?       @relation(fields: [moduleId], references: [id])
  lessonId   String?
  lesson     Lesson?       @relation(fields: [lessonId], references: [id])
  updatedAt  DateTime      @default(now())
}

// ── Batches, Enrollment, Mentors ─────────────────────────────────

enum BatchStatus {
  UPCOMING
  ACTIVE
  COMPLETED
  ARCHIVED
}

model Batch {
  id           String      @id @default(cuid())
  programId    String
  program      Program     @relation(fields: [programId], references: [id], onDelete: Cascade)
  name         String      // "Batch 04"
  code         String      @unique
  startDate    DateTime
  endDate      DateTime
  status       BatchStatus @default(UPCOMING)
  scheduleNote String?     // "Mon, Wed, Fri • 18:00 EST" (batches_mobile) — free text, DECISIONS.md Q18
  capacity     Int?

  enrollments  Enrollment[]
  mentors      MentorAssignment[]
  sessions     Session[]           // PHASE 2
  certificates Certificate[]
}

enum EnrollmentStatus {
  ACTIVE
  COMPLETED
  PENDING
  CANCELLED
  DROPPED
}

enum AccessState {
  GRANTED
  SUSPENDED
  AWAITING
}

// DECISIONS.md Q2 — cohort-only for MVP: programId is required. batchId
// stays nullable at the DB level so self-paced enrollment is possible
// later, but MVP UI and seed data only ever create batch-backed rows.
model Enrollment {
  id              String            @id @default(cuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  programId       String
  program         Program           @relation(fields: [programId], references: [id])
  batchId         String?           // nullable for future self-paced support — DECISIONS.md Q2; always set in MVP
  batch           Batch?            @relation(fields: [batchId], references: [id])
  status          EnrollmentStatus  @default(PENDING)
  accessState     AccessState       @default(AWAITING)
  progressPercent Float             @default(0) // cached rollup from LessonProgress, refreshed on completion events
  enrolledAt      DateTime          @default(now())
  completedAt     DateTime?

  lessonProgress  LessonProgress[]  // FIX A — moved from User
  attempts        Attempt[]         // FIX A — moved from User
  submissions     Submission[]      // FIX A — moved from User
  payments        Payment[]         // PHASE 2
  certificates    Certificate[]
}

// Batch-level mentor staffing (program_detail "assigned mentors" is
// the distinct union of mentors across a program's batches)
model MentorAssignment {
  id        String  @id @default(cuid())
  mentorId  String
  mentor    User    @relation(fields: [mentorId], references: [id], onDelete: Cascade)
  batchId   String
  batch     Batch   @relation(fields: [batchId], references: [id], onDelete: Cascade)
  roleLabel String? // "Lead Instructor" / "Teaching Assistant" (batch_detail_forge_data_analyst_batch_04)

  @@unique([mentorId, batchId])
}

// ── Live Sessions ─────────────────────────────────────────────────

enum SessionStatus {
  SCHEDULED
  STARTING_SOON
  COMPLETED
  CANCELLED
}

// PHASE 2
model Session {
  id          String            @id @default(cuid())
  batchId     String
  batch       Batch             @relation(fields: [batchId], references: [id], onDelete: Cascade)
  hostId      String
  host        User              @relation("SessionHost", fields: [hostId], references: [id])
  title       String
  description String?
  startTime   DateTime
  endTime     DateTime
  meetingUrl  String?           // MVP: external Zoom link
  status      SessionStatus     @default(SCHEDULED)

  agendaItems SessionAgendaItem[]
  attendees   SessionAttendee[]
  questions   PreSessionQuestion[]
}

// PHASE 2
model SessionAgendaItem {
  id            String  @id @default(cuid())
  sessionId     String
  session       Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  topic         String
  durationMins  Int
  order         Int
}

// PHASE 2
// DECISIONS.md Q6 — engagementPercent dropped: its source was never
// confirmed (live poll? follow-up quiz?), so it isn't persisted. present only.
model SessionAttendee {
  id                String   @id @default(cuid())
  sessionId         String
  session           Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  present           Boolean?  // null = not yet marked

  @@unique([sessionId, userId])
}

// PHASE 2
model PreSessionQuestion {
  id           String   @id @default(cuid())
  sessionId    String
  session      Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  questionText String
  addressed    Boolean  @default(false)
  submittedAt  DateTime @default(now())
}

// ── Assessments & Quizzes (unified — DECISIONS.md Q4) ─────────────

enum QuestionType {
  MULTIPLE_CHOICE
  CODE_SNIPPET
  TRUE_FALSE
}

// PRACTICE = practice-hub quiz, no certificate weight.
// GRADED = counts toward certificate eligibility (CertificateEligibilityRule.REQUIRED_ASSESSMENTS).
enum AssessmentKind {
  PRACTICE
  GRADED
}

model Assessment {
  id                    String         @id @default(cuid())
  moduleId              String
  module                Module         @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  title                 String
  kind                  AssessmentKind @default(PRACTICE) // DECISIONS.md Q4 — explicit, not inferred from passingScorePercent
  status                ContentStatus  @default(DRAFT)
  timeLimitMins         Int?
  passingScorePercent   Int?
  allowedAttempts       Int            @default(1) // 0 = unlimited
  shuffleQuestions      Boolean        @default(false)
  showResultsImmediately Boolean       @default(true)
  updatedAt             DateTime       @updatedAt

  questions             Question[]
  attempts              Attempt[]
}

model Question {
  id          String        @id @default(cuid())
  assessmentId String
  assessment  Assessment    @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  order       Int
  type        QuestionType
  text        String
  points      Int
  explanation String?

  options     QuestionOption[]
  answers     Answer[]
}

model QuestionOption {
  id         String   @id @default(cuid())
  questionId String
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  label      String   // "A" / "B" / "C" / "D"
  text       String
  isCorrect  Boolean  @default(false)

  answers    Answer[]
}

enum AttemptStatus {
  IN_PROGRESS
  SUBMITTED
  GRADED
}

// FIX A — scoped to Enrollment, not User (see LessonProgress note above).
model Attempt {
  id           String        @id @default(cuid())
  assessmentId String
  assessment   Assessment    @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  enrollmentId String
  enrollment   Enrollment    @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  attemptNumber Int
  status       AttemptStatus @default(IN_PROGRESS)
  scorePercent Float?
  passed       Boolean?
  startedAt    DateTime      @default(now())
  submittedAt  DateTime?

  answers      Answer[]

  @@unique([assessmentId, enrollmentId, attemptNumber])
}

// Saved per-answer (not only on submit) so a dropped connection
// never loses a full attempt — see prompt pack's quiz-autosave warning
model Answer {
  id               String          @id @default(cuid())
  attemptId        String
  attempt          Attempt         @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  questionId       String
  question         Question        @relation(fields: [questionId], references: [id], onDelete: Cascade)
  selectedOptionId String?
  selectedOption   QuestionOption? @relation(fields: [selectedOptionId], references: [id])
  freeTextAnswer   String?         // for CODE_SNIPPET questions
  flagged          Boolean         @default(false)
  answeredAt       DateTime        @updatedAt

  @@unique([attemptId, questionId])
}

// ── Assignments, Submissions, Reviews ─────────────────────────────

enum AssignmentType {
  ASSIGNMENT
  PROJECT
}

model Assignment {
  id             String         @id @default(cuid())
  moduleId       String
  module         Module         @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  title          String
  type           AssignmentType @default(ASSIGNMENT)
  overview       String
  requirements   String[]       // checklist bullets
  instructions   Json           // ordered [{ step, title, description }]
  estimatedMins  Int?
  dueAt          DateTime?
  maxAttempts    Int            @default(1)
  allowGithubUrl Boolean        @default(false)

  resources      AssignmentResource[]
  submissions    Submission[]
  rubricCriteria RubricCriterion[] // FIX B — defined per assignment, not invented per review
}

// FIX B — the rubric an assignment is graded against. Previously this
// hung off Review, meaning each mentor invented criteria at grading
// time and two learners on the same assignment couldn't be compared
// on the same scale. Now fixed per assignment; Review scores against it.
model RubricCriterion {
  id           String       @id @default(cuid())
  assignmentId String
  assignment   Assignment   @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  name         String
  description  String?
  maxScore     Int
  order        Int

  scores       RubricScore[]
}

model AssignmentResource {
  id           String     @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  name         String
  fileUrl      String
  fileType     String
  fileSizeKB   Int?
}

enum SubmissionStatus {
  NOT_STARTED
  SUBMITTED
  UNDER_REVIEW
  REVIEWED
  REVISION_REQUESTED
}

// FIX A — scoped to Enrollment, not User (see LessonProgress note above).
model Submission {
  id            String           @id @default(cuid())
  assignmentId  String
  assignment    Assignment       @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  enrollmentId  String
  enrollment    Enrollment       @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  attemptNumber Int              @default(1)
  status        SubmissionStatus @default(NOT_STARTED)
  fileUrl       String?
  githubUrl     String?
  notes         String?
  submittedAt   DateTime?

  review        Review?
}

enum ReviewOutcome {
  APPROVED
  REVISION_REQUESTED
}

model Review {
  id               String            @id @default(cuid())
  submissionId     String            @unique
  submission       Submission        @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  mentorId         String
  mentor           User              @relation("ReviewedBy", fields: [mentorId], references: [id])
  overallFeedback  String
  score            Int?
  maxScore         Int?
  outcome          ReviewOutcome?
  reviewedAt       DateTime?
  createdAt        DateTime          @default(now())

  rubricScores     RubricScore[]
}

// FIX B — one row per RubricCriterion this review scored. See
// RubricCriterion above (now defined on Assignment, not Review).
model RubricScore {
  id           String          @id @default(cuid())
  reviewId     String
  review       Review          @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  criterionId  String
  criterion    RubricCriterion @relation(fields: [criterionId], references: [id])
  score        Int

  @@unique([reviewId, criterionId])
}

// ── Certificates ───────────────────────────────────────────────────

enum CertificateStatus {
  VALID
  REVOKED
}

// certificateNumber is the opaque public ID used at /verify/[id] —
// route must work logged-out, so lookups are by this field only.
model Certificate {
  id                String            @id @default(cuid())
  certificateNumber String            @unique // "LUM-2026-00124"
  userId            String
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  programId         String
  program           Program           @relation(fields: [programId], references: [id])
  batchId           String?
  batch             Batch?            @relation(fields: [batchId], references: [id])
  enrollmentId      String?
  enrollment        Enrollment?       @relation(fields: [enrollmentId], references: [id])
  templateName      String            @default("Standard")
  status            CertificateStatus @default(VALID)
  issuedAt          DateTime          @default(now())
  revokedAt         DateTime?
  revokedReason     String?
}

enum EligibilityRuleType {
  PROGRAM_COMPLETION
  REQUIRED_ASSESSMENTS // DECISIONS.md Q4 — only Assessment.kind = GRADED counts
  MIN_CUMULATIVE_SCORE
  IDENTITY_VERIFICATION
}

// PHASE 2
model CertificateEligibilityRule {
  id              String              @id @default(cuid())
  programId       String?             // null = platform-wide default gate
  program         Program?            @relation(fields: [programId], references: [id])
  ruleType        EligibilityRuleType
  required        Boolean             @default(true)
  thresholdPercent Int?               // e.g. 70 for MIN_CUMULATIVE_SCORE
}

// ── Payments (stubbed gateway in MVP) ─────────────────────────────

enum PaymentStatus {
  SUCCESSFUL
  PENDING
  FAILED
  REFUNDED
}

// PHASE 2
model Payment {
  id           String        @id @default(cuid())
  enrollmentId String?
  enrollment   Enrollment?   @relation(fields: [enrollmentId], references: [id])
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  orderId      String        @unique
  providerRef  String?
  amount       Decimal       @db.Decimal(10, 2)
  currency     String        @default("INR")
  method       String        // free text, not an enum — DECISIONS.md Q19
  status       PaymentStatus @default(PENDING)
  createdAt    DateTime      @default(now())
  refundedAt   DateTime?

  events       PaymentEvent[]
}

// PHASE 2
model PaymentEvent {
  id          String   @id @default(cuid())
  paymentId   String
  payment     Payment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  eventType   String   // ORDER_CREATED / PAYMENT_INITIATED / PAYMENT_SUCCESSFUL / ENROLLMENT_CREATED / REFUNDED
  description String
  occurredAt  DateTime @default(now())
}

// ── Notifications & Preferences ───────────────────────────────────

// PHASE 2
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // ASSIGNMENT_FEEDBACK / NEW_LESSON / ASSIGNMENT_DUE / ...
  title     String
  body      String
  actionUrl String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}

// PHASE 2
model NotificationPreference {
  id                    String  @id @default(cuid())
  userId                String  @unique
  user                  User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseUpdates         Boolean @default(true)
  assignmentReminders   Boolean @default(true)
  feedbackNotifications Boolean @default(true)
  mentorUpdates         Boolean @default(true)
  systemNotifications   Boolean @default(true)
}

// ── Platform Admin Settings ────────────────────────────────────────
// DECISIONS.md Q13 — all admin settings screens deferred to Phase 2 wholesale.

// PHASE 2 — Singleton row (id fixed to "default")
model PlatformSetting {
  id                  String @id @default("default")
  platformName        String @default("LumoraSpace")
  platformDescription String?
  logoUrl             String?
  supportEmail        String?
  timezone            String @default("UTC")
  defaultLanguage     String @default("en")
  dateFormat          String @default("iso")
}

enum IntegrationStatus {
  CONNECTED
  CONFIG_REQUIRED
}

// PHASE 2
model IntegrationConnection {
  id         String            @id @default(cuid())
  service    String            @unique // SENDGRID / ZOOM / RAZORPAY / AWS_S3
  category   String
  status     IntegrationStatus @default(CONFIG_REQUIRED)
  lastSyncAt DateTime?
  detail     String?           // free-text status detail, e.g. "14 Active Meetings", "Missing IAM Role"
}
```

## Fields invented (implied by the UI but not literally shown)

- `User.passwordHash`, `twoFactorEnabled` — implied by the login/security forms, never rendered as data.
- `LessonProgress.videoProgressPercent` vs `completed` boolean — resolved by `DECISIONS.md` Q3: `completed` (explicit "Mark as Complete") drives completion, `videoProgressPercent` is a resume hint only.
- `Enrollment.programId` (required) and `batchId` (nullable) — resolved by `DECISIONS.md` Q2: cohort-only for MVP, schema stays open for self-paced later.
- `Attempt.attemptNumber` / `Submission.attemptNumber` — screens show "Attempts 1/3" as a fraction; the underlying per-attempt row isn't shown, only the count.
- `Enrollment.id` as the scoping key for `LessonProgress`, `Attempt`, and `Submission` (FIX A) — no screen shows this distinction directly; invented to make per-cohort progress/grading correct for a learner who repeats a batch or holds two enrollments.
- `RubricCriterion` living on `Assignment` rather than `Review` (FIX B) — screens render rubrics as a fixed-looking table, implying they're authored once per assignment, not invented per grading pass.
- `Assessment.kind` (`PRACTICE` / `GRADED`) — resolved by `DECISIONS.md` Q4: unified model, explicit kind field rather than inferring from a null `passingScorePercent`.
- `CertificateEligibilityRule`, `IntegrationConnection`, `PlatformSetting` — modeled for completeness (Phase 2), but `DECISIONS.md` Q13 defers all admin settings UI, so these ship with no seed data or endpoints in MVP.
- `MentorAssignment.roleLabel` — free text ("Lead Instructor") rather than an enum, since values seen vary per batch.
- `Payment.method` as free text — resolved by `DECISIONS.md` Q19, matching the "stub the gateway" MVP decision.
- `SessionAttendee.engagementPercent` — removed per `DECISIONS.md` Q6; its source was never confirmed, so it isn't persisted at all rather than guessed.
