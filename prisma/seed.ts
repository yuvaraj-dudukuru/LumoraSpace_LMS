// Idempotent dev seed: deletes every row this script owns (in FK-safe child
// -> parent order), then recreates the full dataset. Never touches Auth.js's
// Account/Session/VerificationToken tables directly (User deletion cascades
// into them per schema.prisma's onDelete: Cascade). Seeds nothing for any
// // PHASE 2 model — see DATA_MODEL.md.
import {
  PrismaClient,
  Role,
  UserStatus,
  ExperienceLevel,
  ProgramLevel,
  ProgramFormat,
  ContentStatus,
  LessonType,
  BatchStatus,
  EnrollmentStatus,
  AccessState,
  AssessmentKind,
  QuestionType,
  AttemptStatus,
  AssignmentType,
  SubmissionStatus,
  ReviewOutcome,
  CertificateStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_PASSWORD = "LumoraDev123!";

async function resetDomainData(): Promise<void> {
  await prisma.rubricScore.deleteMany();
  await prisma.review.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignmentResource.deleteMany();
  await prisma.rubricCriterion.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.mentorAssignment.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.programOutcome.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.program.deleteMany();
  await prisma.user.deleteMany();
}

type LessonDef = { title: string; type: LessonType; order: number; durationMins?: number };
type ModuleDef = { title: string; order: number; lessons: LessonDef[] };

const FORGE_DATA_ANALYST_MODULES: ModuleDef[] = [
  {
    title: "The Data Lifecycle",
    order: 1,
    lessons: [
      { title: "What is Data Analysis?", type: LessonType.VIDEO, order: 1, durationMins: 12 },
      { title: "The Data Lifecycle Explained", type: LessonType.VIDEO, order: 2, durationMins: 15 },
      { title: "Data Sources and Collection", type: LessonType.READING, order: 3 },
      { title: "Data Quality Fundamentals", type: LessonType.READING, order: 4 },
      { title: "Foundational Quiz", type: LessonType.QUIZ, order: 5 },
    ],
  },
  {
    title: "Introduction to Data Analysis",
    order: 2,
    lessons: [
      { title: "SQL Fundamentals", type: LessonType.VIDEO, order: 1, durationMins: 18 },
      { title: "Writing Your First Queries", type: LessonType.VIDEO, order: 2, durationMins: 20 },
      { title: "Joins and Aggregations", type: LessonType.READING, order: 3 },
      { title: "SQL Optimization Techniques", type: LessonType.VIDEO, order: 4, durationMins: 16 },
      { title: "Practice: SQL Q&A", type: LessonType.READING, order: 5 },
    ],
  },
  {
    title: "Exploratory Data Analysis",
    order: 3,
    lessons: [
      { title: "Descriptive Statistics", type: LessonType.VIDEO, order: 1, durationMins: 14 },
      { title: "Data Visualization Basics", type: LessonType.VIDEO, order: 2, durationMins: 17 },
      { title: "Finding Patterns in Data", type: LessonType.READING, order: 3 },
      { title: "EDA Case Study", type: LessonType.READING, order: 4 },
    ],
  },
  {
    title: "Data Cleaning & Preparation",
    order: 4,
    lessons: [
      { title: "Handling Missing Data", type: LessonType.VIDEO, order: 1, durationMins: 13 },
      { title: "Data Cleaning Techniques", type: LessonType.VIDEO, order: 2, durationMins: 19 },
      { title: "Data Validation & Quality Checks", type: LessonType.READING, order: 3 },
      { title: "Outlier Detection", type: LessonType.READING, order: 4 },
      { title: "Module Quiz", type: LessonType.QUIZ, order: 5 },
    ],
  },
];

const FORGE_FULL_STACK_MODULES: ModuleDef[] = [
  {
    title: "Foundations",
    order: 1,
    lessons: [
      { title: "Environment Setup", type: LessonType.READING, order: 1 },
      { title: "Git & Version Control", type: LessonType.VIDEO, order: 2, durationMins: 10 },
      { title: "JavaScript Essentials", type: LessonType.VIDEO, order: 3, durationMins: 22 },
      { title: "Foundations Quiz", type: LessonType.QUIZ, order: 4 },
    ],
  },
  {
    title: "Frontend Engineering",
    order: 2,
    lessons: [
      { title: "React Fundamentals", type: LessonType.VIDEO, order: 1, durationMins: 20 },
      { title: "Component Architecture", type: LessonType.VIDEO, order: 2, durationMins: 18 },
      { title: "State Management", type: LessonType.READING, order: 3 },
      { title: "Styling with Tailwind", type: LessonType.VIDEO, order: 4, durationMins: 15 },
      { title: "Frontend Project Brief", type: LessonType.READING, order: 5 },
    ],
  },
  {
    title: "API Architecture",
    order: 3,
    lessons: [
      { title: "REST API Design", type: LessonType.VIDEO, order: 1, durationMins: 16 },
      { title: "Middleware & Security", type: LessonType.READING, order: 2 },
      { title: "Database Schemas & ORMs", type: LessonType.READING, order: 3 },
      { title: "API Documentation", type: LessonType.READING, order: 4 },
    ],
  },
  {
    title: "Backend Infrastructure",
    order: 4,
    lessons: [
      { title: "Server Deployment", type: LessonType.VIDEO, order: 1, durationMins: 14 },
      { title: "Environment Variables & Secrets", type: LessonType.READING, order: 2 },
      { title: "Scaling Basics", type: LessonType.VIDEO, order: 3, durationMins: 12 },
      { title: "Backend Infrastructure Project", type: LessonType.READING, order: 4 },
    ],
  },
];

async function main(): Promise<void> {
  await resetDomainData();

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  // ── Users ──────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      name: "Neha Kapoor",
      email: "admin@lumoraspace.dev",
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      title: "Platform Admin",
      onboardingComplete: true,
    },
  });

  const michaelChen = await prisma.user.create({
    data: {
      name: "Michael Chen",
      email: "michael.chen@lumoraspace.dev",
      passwordHash,
      role: Role.MENTOR,
      status: UserStatus.ACTIVE,
      title: "Lead Instructor",
      onboardingComplete: true,
    },
  });
  const sarahJenkins = await prisma.user.create({
    data: {
      name: "Sarah Jenkins",
      email: "sarah.jenkins@lumoraspace.dev",
      passwordHash,
      role: Role.MENTOR,
      status: UserStatus.ACTIVE,
      title: "Senior Mentor",
      onboardingComplete: true,
    },
  });

  const learnerDefs: {
    name: string;
    email: string;
    experienceLevel: ExperienceLevel;
    learningGoal: string;
    streakDays: number;
  }[] = [
    { name: "Alex Morgan", email: "alex.morgan@example.com", experienceLevel: ExperienceLevel.SOME_EXPERIENCE, learningGoal: "build-skills", streakDays: 9 },
    { name: "Aisha Patel", email: "aisha.patel@example.com", experienceLevel: ExperienceLevel.BEGINNER, learningGoal: "career-switch", streakDays: 4 },
    { name: "David Kim", email: "david.kim@example.com", experienceLevel: ExperienceLevel.BEGINNER, learningGoal: "build-skills", streakDays: 2 },
    { name: "Marcus Wei", email: "marcus.wei@example.com", experienceLevel: ExperienceLevel.INTERMEDIATE, learningGoal: "improve-skills", streakDays: 15 },
    { name: "Priya Sharma", email: "priya.sharma@example.com", experienceLevel: ExperienceLevel.BEGINNER, learningGoal: "explore-tech", streakDays: 1 },
    { name: "Daniel Osei", email: "daniel.osei@example.com", experienceLevel: ExperienceLevel.SOME_EXPERIENCE, learningGoal: "career-switch", streakDays: 0 },
    { name: "Wei Zhang", email: "wei.zhang@example.com", experienceLevel: ExperienceLevel.ADVANCED, learningGoal: "build-projects", streakDays: 22 },
    { name: "Fatima Al-Sayed", email: "fatima.alsayed@example.com", experienceLevel: ExperienceLevel.INTERMEDIATE, learningGoal: "build-skills", streakDays: 7 },
    { name: "Lucas Silva", email: "lucas.silva@example.com", experienceLevel: ExperienceLevel.BEGINNER, learningGoal: "career-switch", streakDays: 1 },
    { name: "Hannah Cohen", email: "hannah.cohen@example.com", experienceLevel: ExperienceLevel.SOME_EXPERIENCE, learningGoal: "improve-skills", streakDays: 0 },
    { name: "Noah Andersen", email: "noah.andersen@example.com", experienceLevel: ExperienceLevel.INTERMEDIATE, learningGoal: "build-projects", streakDays: 31 },
    { name: "Grace Mwangi", email: "grace.mwangi@example.com", experienceLevel: ExperienceLevel.ADVANCED, learningGoal: "career-switch", streakDays: 28 },
  ];

  const learners = new Map<string, Awaited<ReturnType<typeof prisma.user.create>>>();
  for (const def of learnerDefs) {
    const learner = await prisma.user.create({
      data: {
        name: def.name,
        email: def.email,
        passwordHash,
        role: Role.LEARNER,
        status: UserStatus.ACTIVE,
        experienceLevel: def.experienceLevel,
        learningGoal: def.learningGoal,
        streakDays: def.streakDays,
        onboardingComplete: true,
      },
    });
    learners.set(def.name, learner);
  }
  const learner = (name: string) => {
    const found = learners.get(name);
    if (!found) throw new Error(`Seed error: learner "${name}" was not created`);
    return found;
  };

  // ── Programs, Modules, Lessons ────────────────────────────────
  const forgeDataAnalyst = await prisma.program.create({
    data: {
      name: "Forge Data Analyst",
      slug: "forge-data-analyst",
      description: "A cohort-based bootcamp covering SQL, exploratory analysis, and data cleaning for aspiring data analysts.",
      level: ProgramLevel.BEGINNER,
      durationWeeks: 10,
      format: ProgramFormat.ONLINE,
      credentialType: "Professional Certificate",
      price: 899.0,
      status: ContentStatus.PUBLISHED,
    },
  });
  const forgeFullStack = await prisma.program.create({
    data: {
      name: "Forge Full Stack Developer",
      slug: "forge-full-stack-developer",
      description: "An intermediate cohort program covering frontend engineering, API architecture, and backend infrastructure.",
      level: ProgramLevel.INTERMEDIATE,
      durationWeeks: 14,
      format: ProgramFormat.ONLINE,
      credentialType: "Professional Certificate",
      price: 1299.0,
      status: ContentStatus.PUBLISHED,
    },
  });

  const lessonIdsByProgramAndTitle = new Map<string, string>();
  const moduleIdByProgramAndTitle = new Map<string, string>();

  async function createModules(programId: string, programSlug: string, defs: ModuleDef[]): Promise<string[]> {
    const orderedLessonIds: string[] = [];
    for (const moduleDef of defs) {
      const module = await prisma.module.create({
        data: {
          programId,
          title: moduleDef.title,
          order: moduleDef.order,
          status: ContentStatus.PUBLISHED,
        },
      });
      moduleIdByProgramAndTitle.set(`${programSlug}::${moduleDef.title}`, module.id);
      for (const lessonDef of moduleDef.lessons) {
        const lesson = await prisma.lesson.create({
          data: {
            moduleId: module.id,
            title: lessonDef.title,
            type: lessonDef.type,
            order: lessonDef.order,
            durationMins: lessonDef.durationMins,
          },
        });
        lessonIdsByProgramAndTitle.set(`${programSlug}::${lessonDef.title}`, lesson.id);
        orderedLessonIds.push(lesson.id);
      }
    }
    return orderedLessonIds;
  }

  const dataAnalystLessonIds = await createModules(forgeDataAnalyst.id, "fda", FORGE_DATA_ANALYST_MODULES);
  const fullStackLessonIds = await createModules(forgeFullStack.id, "fsd", FORGE_FULL_STACK_MODULES);

  // ── Batches ────────────────────────────────────────────────────
  const now = new Date();
  const weeksAgo = (weeks: number) => new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  const weeksFromNow = (weeks: number) => new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

  const fdaBatch04 = await prisma.batch.create({
    data: {
      programId: forgeDataAnalyst.id,
      name: "Batch 04",
      code: "FDA-B04",
      startDate: weeksAgo(4),
      endDate: weeksFromNow(6),
      status: BatchStatus.ACTIVE,
      scheduleNote: "Mon, Wed, Fri • 18:00 EST",
      capacity: 30,
    },
  });
  const fdaBatch05 = await prisma.batch.create({
    data: {
      programId: forgeDataAnalyst.id,
      name: "Batch 05",
      code: "FDA-B05",
      startDate: weeksFromNow(8),
      endDate: weeksFromNow(18),
      status: BatchStatus.UPCOMING,
      scheduleNote: "Tue, Thu • 19:00 EST",
      capacity: 30,
    },
  });
  const fsdBatch03 = await prisma.batch.create({
    data: {
      programId: forgeFullStack.id,
      name: "Batch 03",
      code: "FSD-B03",
      startDate: weeksAgo(6),
      endDate: weeksFromNow(8),
      status: BatchStatus.ACTIVE,
      scheduleNote: "Mon, Wed, Fri • 17:00 EST",
      capacity: 25,
    },
  });
  await prisma.batch.create({
    data: {
      programId: forgeFullStack.id,
      name: "Batch 04",
      code: "FSD-B04",
      startDate: weeksFromNow(10),
      endDate: weeksFromNow(24),
      status: BatchStatus.UPCOMING,
      scheduleNote: "Tue, Thu • 18:00 EST",
      capacity: 25,
    },
  });

  // ── Mentor assignments (to the active batches) ────────────────
  await prisma.mentorAssignment.create({ data: { mentorId: michaelChen.id, batchId: fdaBatch04.id, roleLabel: "Lead Instructor" } });
  await prisma.mentorAssignment.create({ data: { mentorId: sarahJenkins.id, batchId: fdaBatch04.id, roleLabel: "Teaching Assistant" } });
  await prisma.mentorAssignment.create({ data: { mentorId: sarahJenkins.id, batchId: fsdBatch03.id, roleLabel: "Lead Instructor" } });
  await prisma.mentorAssignment.create({ data: { mentorId: michaelChen.id, batchId: fsdBatch03.id, roleLabel: "Teaching Assistant" } });

  // ── Enrollments + LessonProgress ──────────────────────────────
  type ActiveLearnerPlan = { name: string; batch: typeof fdaBatch04; programId: string; lessonIds: string[]; targetFraction: number };

  const activePlans: ActiveLearnerPlan[] = [
    { name: "Alex Morgan", batch: fdaBatch04, programId: forgeDataAnalyst.id, lessonIds: dataAnalystLessonIds, targetFraction: 0.62 },
    { name: "Aisha Patel", batch: fdaBatch04, programId: forgeDataAnalyst.id, lessonIds: dataAnalystLessonIds, targetFraction: 0.45 },
    { name: "David Kim", batch: fdaBatch04, programId: forgeDataAnalyst.id, lessonIds: dataAnalystLessonIds, targetFraction: 0.3 },
    { name: "Marcus Wei", batch: fdaBatch04, programId: forgeDataAnalyst.id, lessonIds: dataAnalystLessonIds, targetFraction: 0.8 },
    { name: "Priya Sharma", batch: fdaBatch04, programId: forgeDataAnalyst.id, lessonIds: dataAnalystLessonIds, targetFraction: 0.15 },
    { name: "Wei Zhang", batch: fsdBatch03, programId: forgeFullStack.id, lessonIds: fullStackLessonIds, targetFraction: 0.95 },
    { name: "Fatima Al-Sayed", batch: fsdBatch03, programId: forgeFullStack.id, lessonIds: fullStackLessonIds, targetFraction: 0.55 },
    { name: "Lucas Silva", batch: fsdBatch03, programId: forgeFullStack.id, lessonIds: fullStackLessonIds, targetFraction: 0.05 },
  ];

  const enrollmentByLearner = new Map<string, Awaited<ReturnType<typeof prisma.enrollment.create>>>();

  for (const plan of activePlans) {
    const completedCount = Math.max(1, Math.round(plan.targetFraction * plan.lessonIds.length));
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: learner(plan.name).id,
        programId: plan.programId,
        batchId: plan.batch.id,
        status: EnrollmentStatus.ACTIVE,
        accessState: AccessState.GRANTED,
        progressPercent: Math.round((completedCount / plan.lessonIds.length) * 1000) / 10,
        enrolledAt: weeksAgo(4),
      },
    });
    enrollmentByLearner.set(plan.name, enrollment);

    for (let i = 0; i < completedCount; i++) {
      await prisma.lessonProgress.create({
        data: {
          enrollmentId: enrollment.id,
          lessonId: plan.lessonIds[i],
          completed: true,
          completedAt: weeksAgo(3),
        },
      });
    }
    if (completedCount < plan.lessonIds.length) {
      await prisma.lessonProgress.create({
        data: {
          enrollmentId: enrollment.id,
          lessonId: plan.lessonIds[completedCount],
          completed: false,
          videoProgressPercent: 35,
        },
      });
    }
  }

  // Pending / awaiting access (Q22 — no content access until admin grants)
  const danielEnrollment = await prisma.enrollment.create({
    data: {
      userId: learner("Daniel Osei").id,
      programId: forgeDataAnalyst.id,
      batchId: fdaBatch04.id,
      status: EnrollmentStatus.PENDING,
      accessState: AccessState.AWAITING,
      enrolledAt: weeksAgo(0),
    },
  });
  const hannahEnrollment = await prisma.enrollment.create({
    data: {
      userId: learner("Hannah Cohen").id,
      programId: forgeFullStack.id,
      batchId: fsdBatch03.id,
      status: EnrollmentStatus.PENDING,
      accessState: AccessState.AWAITING,
      enrolledAt: weeksAgo(0),
    },
  });
  void danielEnrollment;
  void hannahEnrollment;

  // Completed, with certificates
  const completedLearners = ["Noah Andersen", "Grace Mwangi"] as const;
  const certificateNumbers: Record<(typeof completedLearners)[number], string> = {
    "Noah Andersen": "LUM-2026-00201",
    "Grace Mwangi": "LUM-2026-00202",
  };
  for (const name of completedLearners) {
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: learner(name).id,
        programId: forgeFullStack.id,
        batchId: fsdBatch03.id,
        status: EnrollmentStatus.COMPLETED,
        accessState: AccessState.GRANTED,
        progressPercent: 100,
        enrolledAt: weeksAgo(6),
        completedAt: weeksAgo(1),
      },
    });
    enrollmentByLearner.set(name, enrollment);
    for (let i = 0; i < fullStackLessonIds.length; i++) {
      await prisma.lessonProgress.create({
        data: {
          enrollmentId: enrollment.id,
          lessonId: fullStackLessonIds[i],
          completed: true,
          completedAt: weeksAgo(2),
        },
      });
    }
    await prisma.certificate.create({
      data: {
        certificateNumber: certificateNumbers[name],
        userId: learner(name).id,
        programId: forgeFullStack.id,
        batchId: fsdBatch03.id,
        enrollmentId: enrollment.id,
        templateName: "Standard",
        status: CertificateStatus.VALID,
        issuedAt: weeksAgo(1),
      },
    });
  }

  // ── Assessments, Questions, Attempts, Answers ─────────────────
  const sqlModuleId = moduleIdByProgramAndTitle.get("fda::Introduction to Data Analysis");
  if (!sqlModuleId) throw new Error("Seed error: SQL module not found");

  const sqlAssessment = await prisma.assessment.create({
    data: {
      moduleId: sqlModuleId,
      title: "SQL Fundamentals Assessment",
      kind: AssessmentKind.GRADED,
      status: ContentStatus.PUBLISHED,
      timeLimitMins: 30,
      passingScorePercent: 70,
      allowedAttempts: 2,
      shuffleQuestions: false,
      showResultsImmediately: true,
    },
  });

  type QuestionDef = { text: string; type: QuestionType; options: { label: string; text: string; isCorrect: boolean }[] };
  const sqlQuestionDefs: QuestionDef[] = [
    {
      text: "Which SQL clause is used to filter rows before grouping?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "WHERE", isCorrect: true },
        { label: "B", text: "GROUP BY", isCorrect: false },
        { label: "C", text: "HAVING", isCorrect: false },
        { label: "D", text: "ORDER BY", isCorrect: false },
      ],
    },
    {
      text: "Which keyword retrieves only unique values from a column?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "DISTINCT", isCorrect: true },
        { label: "B", text: "UNIQUE", isCorrect: false },
        { label: "C", text: "ONLY", isCorrect: false },
        { label: "D", text: "FILTER", isCorrect: false },
      ],
    },
    {
      text: "Which JOIN returns all rows from both tables, matching where possible?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "INNER JOIN", isCorrect: false },
        { label: "B", text: "FULL OUTER JOIN", isCorrect: true },
        { label: "C", text: "LEFT JOIN", isCorrect: false },
        { label: "D", text: "CROSS JOIN", isCorrect: false },
      ],
    },
    {
      text: "A primary key column can contain NULL values.",
      type: QuestionType.TRUE_FALSE,
      options: [
        { label: "A", text: "True", isCorrect: false },
        { label: "B", text: "False", isCorrect: true },
      ],
    },
    {
      text: "Which clause filters groups after aggregation?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "WHERE", isCorrect: false },
        { label: "B", text: "HAVING", isCorrect: true },
        { label: "C", text: "GROUP BY", isCorrect: false },
        { label: "D", text: "LIMIT", isCorrect: false },
      ],
    },
    {
      text: "Which function returns the number of rows in a result set?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "SUM()", isCorrect: false },
        { label: "B", text: "AVG()", isCorrect: false },
        { label: "C", text: "COUNT()", isCorrect: true },
        { label: "D", text: "MAX()", isCorrect: false },
      ],
    },
    {
      text: "An index can improve the performance of SELECT queries.",
      type: QuestionType.TRUE_FALSE,
      options: [
        { label: "A", text: "True", isCorrect: true },
        { label: "B", text: "False", isCorrect: false },
      ],
    },
    {
      text: "Which SQL statement is used to add a new row to a table?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "UPDATE", isCorrect: false },
        { label: "B", text: "INSERT", isCorrect: true },
        { label: "C", text: "ALTER", isCorrect: false },
        { label: "D", text: "MERGE", isCorrect: false },
      ],
    },
  ];

  const sqlQuestions: { id: string; options: { id: string; isCorrect: boolean }[] }[] = [];
  for (let i = 0; i < sqlQuestionDefs.length; i++) {
    const def = sqlQuestionDefs[i];
    const question = await prisma.question.create({
      data: { assessmentId: sqlAssessment.id, order: i + 1, type: def.type, text: def.text, points: 1 },
    });
    const options: { id: string; isCorrect: boolean }[] = [];
    for (const optDef of def.options) {
      const option = await prisma.questionOption.create({
        data: { questionId: question.id, label: optDef.label, text: optDef.text, isCorrect: optDef.isCorrect },
      });
      options.push({ id: option.id, isCorrect: optDef.isCorrect });
    }
    sqlQuestions.push({ id: question.id, options });
  }

  async function recordAttempt(
    enrollmentId: string,
    assessmentId: string,
    questions: { id: string; options: { id: string; isCorrect: boolean }[] }[],
    correctMask: boolean[],
    passingScorePercent: number | null,
  ): Promise<void> {
    const correctCount = correctMask.filter(Boolean).length;
    const scorePercent = Math.round((correctCount / questions.length) * 1000) / 10;
    const passed = passingScorePercent === null ? null : scorePercent >= passingScorePercent;
    const attempt = await prisma.attempt.create({
      data: {
        assessmentId,
        enrollmentId,
        attemptNumber: 1,
        status: AttemptStatus.GRADED,
        scorePercent,
        passed,
        startedAt: weeksAgo(2),
        submittedAt: weeksAgo(2),
      },
    });
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const wantCorrect = correctMask[i];
      const chosen = q.options.find((o) => o.isCorrect === wantCorrect) ?? q.options[0];
      await prisma.answer.create({
        data: {
          attemptId: attempt.id,
          questionId: q.id,
          selectedOptionId: chosen.id,
        },
      });
    }
  }

  // Alex Morgan: 7/8 correct — passing.
  await recordAttempt(
    enrollmentByLearner.get("Alex Morgan")!.id,
    sqlAssessment.id,
    sqlQuestions,
    [true, true, true, true, true, true, true, false],
    70,
  );
  // David Kim: 4/8 correct — failing.
  await recordAttempt(
    enrollmentByLearner.get("David Kim")!.id,
    sqlAssessment.id,
    sqlQuestions,
    [true, false, true, false, true, false, true, false],
    70,
  );

  const foundationsModuleId = moduleIdByProgramAndTitle.get("fsd::Foundations");
  if (!foundationsModuleId) throw new Error("Seed error: Foundations module not found");

  const foundationsQuiz = await prisma.assessment.create({
    data: {
      moduleId: foundationsModuleId,
      title: "Foundations Quiz",
      kind: AssessmentKind.PRACTICE,
      status: ContentStatus.PUBLISHED,
      timeLimitMins: 15,
      allowedAttempts: 0,
      shuffleQuestions: true,
      showResultsImmediately: true,
    },
  });

  const foundationsQuestionDefs: QuestionDef[] = [
    {
      text: "Which company maintains the React library?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "Google", isCorrect: false },
        { label: "B", text: "Meta", isCorrect: true },
        { label: "C", text: "Microsoft", isCorrect: false },
        { label: "D", text: "Amazon", isCorrect: false },
      ],
    },
    {
      text: "What does npm stand for?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "Node Package Manager", isCorrect: true },
        { label: "B", text: "New Programming Method", isCorrect: false },
        { label: "C", text: "Network Package Module", isCorrect: false },
        { label: "D", text: "Node Process Manager", isCorrect: false },
      ],
    },
    {
      text: "Git is a distributed version control system.",
      type: QuestionType.TRUE_FALSE,
      options: [
        { label: "A", text: "True", isCorrect: true },
        { label: "B", text: "False", isCorrect: false },
      ],
    },
    {
      text: "Which HTTP method is idempotent?",
      type: QuestionType.MULTIPLE_CHOICE,
      options: [
        { label: "A", text: "POST", isCorrect: false },
        { label: "B", text: "GET", isCorrect: true },
        { label: "C", text: "PATCH", isCorrect: false },
        { label: "D", text: "CONNECT", isCorrect: false },
      ],
    },
    {
      text: "JavaScript is a statically typed language.",
      type: QuestionType.TRUE_FALSE,
      options: [
        { label: "A", text: "True", isCorrect: false },
        { label: "B", text: "False", isCorrect: true },
      ],
    },
  ];

  const foundationsQuestions: { id: string; options: { id: string; isCorrect: boolean }[] }[] = [];
  for (let i = 0; i < foundationsQuestionDefs.length; i++) {
    const def = foundationsQuestionDefs[i];
    const question = await prisma.question.create({
      data: { assessmentId: foundationsQuiz.id, order: i + 1, type: def.type, text: def.text, points: 1 },
    });
    const options: { id: string; isCorrect: boolean }[] = [];
    for (const optDef of def.options) {
      const option = await prisma.questionOption.create({
        data: { questionId: question.id, label: optDef.label, text: optDef.text, isCorrect: optDef.isCorrect },
      });
      options.push({ id: option.id, isCorrect: optDef.isCorrect });
    }
    foundationsQuestions.push({ id: question.id, options });
  }

  await recordAttempt(
    enrollmentByLearner.get("Wei Zhang")!.id,
    foundationsQuiz.id,
    foundationsQuestions,
    [true, true, true, true, true],
    null,
  );

  // ── Assignments, Rubrics, Submissions, Reviews ─────────────────
  const sqlOptLessonModuleId = sqlModuleId; // "Introduction to Data Analysis"
  const dataCleaningModuleId = moduleIdByProgramAndTitle.get("fda::Data Cleaning & Preparation");
  if (!dataCleaningModuleId) throw new Error("Seed error: Data Cleaning module not found");

  const sqlOptimizationAssignment = await prisma.assignment.create({
    data: {
      moduleId: sqlOptLessonModuleId,
      title: "SQL Optimization",
      type: AssignmentType.ASSIGNMENT,
      overview: "Given a slow-running report query against the sample sales database, rewrite it to cut execution time while preserving identical results.",
      requirements: [
        "Identify the performance bottleneck using EXPLAIN ANALYZE",
        "Rewrite the query to remove unnecessary subqueries or scans",
        "Add or justify any new indexes",
        "Document the before/after execution time",
      ],
      instructions: [
        { step: 1, title: "Profile the query", description: "Run EXPLAIN ANALYZE on the provided query and note the slowest operation." },
        { step: 2, title: "Rewrite", description: "Rewrite the query to address the bottleneck." },
        { step: 3, title: "Verify", description: "Confirm the rewritten query returns identical results." },
        { step: 4, title: "Submit", description: "Submit your SQL file and a short writeup." },
      ],
      estimatedMins: 90,
      dueAt: weeksFromNow(1),
      maxAttempts: 2,
      allowGithubUrl: true,
    },
  });

  const dataCleaningAssignment = await prisma.assignment.create({
    data: {
      moduleId: dataCleaningModuleId,
      title: "Data Cleaning Assignment",
      type: AssignmentType.PROJECT,
      overview: "Clean a messy customer dataset (duplicate rows, inconsistent formatting, missing values) and produce an analysis-ready CSV.",
      requirements: [
        "Handle missing values with a documented strategy",
        "Remove or merge duplicate records",
        "Standardize inconsistent formatting (dates, phone numbers, casing)",
        "Document every transformation in a data-cleaning log",
      ],
      instructions: [
        { step: 1, title: "Audit", description: "Profile the raw dataset and log every quality issue found." },
        { step: 2, title: "Clean", description: "Apply and document each cleaning transformation." },
        { step: 3, title: "Validate", description: "Re-profile the cleaned dataset to confirm issues are resolved." },
        { step: 4, title: "Submit", description: "Submit the cleaned CSV, your script, and the cleaning log." },
      ],
      estimatedMins: 120,
      dueAt: weeksFromNow(2),
      maxAttempts: 1,
      allowGithubUrl: true,
    },
  });

  type CriterionDef = { name: string; description: string; maxScore: number; order: number };
  const sqlOptCriteria: CriterionDef[] = [
    { name: "Correctness", description: "Rewritten query returns identical results to the original.", maxScore: 25, order: 1 },
    { name: "Query Performance", description: "Measured improvement in execution time.", maxScore: 25, order: 2 },
    { name: "Code Readability", description: "Query is well-formatted and reasonably easy to follow.", maxScore: 25, order: 3 },
    { name: "Documentation", description: "Before/after writeup clearly explains the change.", maxScore: 25, order: 4 },
  ];
  const dataCleaningCriteria: CriterionDef[] = [
    { name: "Data Quality Checks", description: "All major quality issues in the raw data were identified.", maxScore: 25, order: 1 },
    { name: "Handling of Missing Values", description: "Missing-value strategy is appropriate and documented.", maxScore: 25, order: 2 },
    { name: "Documentation", description: "Cleaning log records every transformation applied.", maxScore: 25, order: 3 },
    { name: "Reproducibility", description: "Script can be re-run on the raw data to reproduce the output.", maxScore: 25, order: 4 },
  ];

  async function createCriteria(assignmentId: string, defs: CriterionDef[]): Promise<{ id: string; name: string }[]> {
    const created: { id: string; name: string }[] = [];
    for (const def of defs) {
      const criterion = await prisma.rubricCriterion.create({
        data: { assignmentId, name: def.name, description: def.description, maxScore: def.maxScore, order: def.order },
      });
      created.push({ id: criterion.id, name: def.name });
    }
    return created;
  }

  const sqlOptCriteriaRows = await createCriteria(sqlOptimizationAssignment.id, sqlOptCriteria);
  const dataCleaningCriteriaRows = await createCriteria(dataCleaningAssignment.id, dataCleaningCriteria);

  // Alex Morgan — REVIEWED (mirrors the "reviewing_alex_morgan" screen)
  const alexSubmission = await prisma.submission.create({
    data: {
      assignmentId: sqlOptimizationAssignment.id,
      enrollmentId: enrollmentByLearner.get("Alex Morgan")!.id,
      attemptNumber: 1,
      status: SubmissionStatus.REVIEWED,
      fileUrl: "https://storage.lumoraspace.dev/submissions/alex-morgan-sql-optimization.sql",
      githubUrl: "https://github.com/alexmorgan-dev/sql-optimization",
      notes: "Rewrote the correlated subquery as a JOIN and added a composite index on (customer_id, order_date).",
      submittedAt: weeksAgo(1),
    },
  });
  const alexScores = [22, 20, 23, 18];
  const alexReview = await prisma.review.create({
    data: {
      submissionId: alexSubmission.id,
      mentorId: michaelChen.id,
      overallFeedback: "Solid rewrite — execution time dropped from 4.2s to 180ms. Query is readable and the index choice is well justified. Minor: the writeup could include the actual EXPLAIN ANALYZE output for comparison.",
      score: alexScores.reduce((a, b) => a + b, 0),
      maxScore: 100,
      outcome: ReviewOutcome.APPROVED,
      reviewedAt: weeksAgo(0),
    },
  });
  for (let i = 0; i < sqlOptCriteriaRows.length; i++) {
    await prisma.rubricScore.create({
      data: { reviewId: alexReview.id, criterionId: sqlOptCriteriaRows[i].id, score: alexScores[i] },
    });
  }

  // Aisha Patel — UNDER_REVIEW (queue not empty)
  await prisma.submission.create({
    data: {
      assignmentId: sqlOptimizationAssignment.id,
      enrollmentId: enrollmentByLearner.get("Aisha Patel")!.id,
      attemptNumber: 1,
      status: SubmissionStatus.UNDER_REVIEW,
      fileUrl: "https://storage.lumoraspace.dev/submissions/aisha-patel-sql-optimization.sql",
      githubUrl: "https://github.com/aishap/sql-optimization",
      notes: "Replaced the nested subquery with a window function.",
      submittedAt: weeksAgo(0),
    },
  });

  // David Kim — SUBMITTED
  await prisma.submission.create({
    data: {
      assignmentId: sqlOptimizationAssignment.id,
      enrollmentId: enrollmentByLearner.get("David Kim")!.id,
      attemptNumber: 1,
      status: SubmissionStatus.SUBMITTED,
      fileUrl: "https://storage.lumoraspace.dev/submissions/david-kim-sql-optimization.sql",
      githubUrl: "https://github.com/dkim/sql-optimization",
      submittedAt: weeksAgo(0),
    },
  });

  // Marcus Wei — REVISION_REQUESTED
  const marcusSubmission = await prisma.submission.create({
    data: {
      assignmentId: dataCleaningAssignment.id,
      enrollmentId: enrollmentByLearner.get("Marcus Wei")!.id,
      attemptNumber: 1,
      status: SubmissionStatus.REVISION_REQUESTED,
      fileUrl: "https://storage.lumoraspace.dev/submissions/marcus-wei-data-cleaning.csv",
      githubUrl: "https://github.com/marcuswei/data-cleaning",
      notes: "Deduplicated on customer_id and standardized phone numbers.",
      submittedAt: weeksAgo(1),
    },
  });
  const marcusScores = [15, 12, 18, 10];
  const marcusReview = await prisma.review.create({
    data: {
      submissionId: marcusSubmission.id,
      mentorId: sarahJenkins.id,
      overallFeedback: "Good start on deduplication, but several missing-value columns were dropped instead of imputed or documented, and the cleaning log is missing the date-format standardization step. Please revise and resubmit.",
      score: marcusScores.reduce((a, b) => a + b, 0),
      maxScore: 100,
      outcome: ReviewOutcome.REVISION_REQUESTED,
      reviewedAt: weeksAgo(0),
    },
  });
  for (let i = 0; i < dataCleaningCriteriaRows.length; i++) {
    await prisma.rubricScore.create({
      data: { reviewId: marcusReview.id, criterionId: dataCleaningCriteriaRows[i].id, score: marcusScores[i] },
    });
  }

  // Priya Sharma — NOT_STARTED
  await prisma.submission.create({
    data: {
      assignmentId: dataCleaningAssignment.id,
      enrollmentId: enrollmentByLearner.get("Priya Sharma")!.id,
      attemptNumber: 1,
      status: SubmissionStatus.NOT_STARTED,
    },
  });

  console.log("Seed complete:");
  console.log(`  Users: 1 admin, 2 mentors, ${learnerDefs.length} learners`);
  console.log(`  Programs: ${forgeDataAnalyst.name}, ${forgeFullStack.name}`);
  console.log(`  Batches: ${fdaBatch04.code}, ${fdaBatch05.code}, ${fsdBatch03.code}, FSD-B04`);
  console.log(`  Dev login password for every seeded user: ${DEV_PASSWORD}`);
  console.log(`  Admin: ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
