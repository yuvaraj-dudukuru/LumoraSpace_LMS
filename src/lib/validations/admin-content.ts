import { z } from "zod";

/** Zod schemas for the admin authoring forms (programs, batches, mentors,
 * enrollments, curriculum, assessments, announcements). Every one parses a
 * plain object built from FormData — so empty inputs arrive as "" (not
 * undefined), numbers arrive as strings, and a checkbox is "on" or absent.
 * The helpers below normalise exactly those three things. */

/** Required single-line/multi-line text. */
const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** "" → undefined. */
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .transform((value) => (value ? value : undefined));

const emptyToUndefined = (value: unknown) => (value === "" || value === null || value === undefined ? undefined : value);

const requiredInt = (label: string, min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} is required` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`),
  );

const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} must be a number` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .optional(),
  );

const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

const id = (label: string) => z.string({ error: `Select a ${label}` }).min(1, `Select a ${label}`);

/** Turns FormData into the plain object the schemas parse. Repeated keys
 * (the question option inputs) are read separately with getAll. */
export function formObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

// ── Programs ────────────────────────────────────────────────────────

export const programSchema = z.object({
  name: text("Name", 120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(80, "Slug must be at most 80 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers and single hyphens"),
  description: text("Description", 2000),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"], { error: "Select a level" }),
  durationWeeks: requiredInt("Duration", 1, 104),
  format: z.enum(["ONLINE", "HYBRID"], { error: "Select a format" }),
  credentialType: optionalText("Credential", 80),
  price: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Price must be a number" })
      .min(0, "Price cannot be negative")
      .max(9_999_999, "Price is too large")
      .multipleOf(0.01, "Price can have at most 2 decimal places")
      .optional(),
  ),
});

export const programOutcomeSchema = z.object({
  title: text("Title", 80),
  description: text("Description", 300),
});

// ── Batches ─────────────────────────────────────────────────────────

const dateField = (label: string) =>
  z.preprocess(emptyToUndefined, z.coerce.date({ error: `${label} is required` }));

export const batchSchema = z
  .object({
    programId: id("program"),
    name: text("Name", 80),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, "Code must be at least 2 characters")
      .max(20, "Code must be at most 20 characters")
      .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Code can only contain letters, numbers and single hyphens"),
    startDate: dateField("Start date"),
    endDate: dateField("End date"),
    scheduleNote: optionalText("Schedule note", 120),
    capacity: optionalInt("Capacity", 1, 1000),
  })
  .refine((batch) => batch.endDate.getTime() > batch.startDate.getTime(), {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export const batchStatusSchema = z.object({
  status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"]),
});

export const batchMentorSchema = z.object({
  mentorId: id("mentor"),
  roleLabel: optionalText("Role", 80),
});

// ── Enrollments / mentors ───────────────────────────────────────────

export const createEnrollmentSchema = z.object({
  userId: id("learner"),
  batchId: id("batch"),
  grantAccess: checkbox,
});

export const addMentorSchema = z.object({
  name: text("Name", 120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  title: optionalText("Title", 80),
});

// ── Curriculum ──────────────────────────────────────────────────────

export const moduleSchema = z.object({
  title: text("Title", 120),
  description: optionalText("Description", 500),
  estimatedDurationMins: optionalInt("Estimated duration", 1, 6000),
});

const httpUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(500, "URL must be at most 500 characters")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a full http(s) URL")
    .optional(),
);

export const lessonSchema = z.object({
  title: text("Title", 160),
  type: z.enum(["VIDEO", "READING", "QUIZ"], { error: "Select a lesson type" }),
  durationMins: optionalInt("Duration", 1, 600),
  description: optionalText("Description", 500),
  videoUrl: httpUrl,
  bodyContent: optionalText("Reading content", 20_000),
  assessmentId: optionalText("Assessment", 60),
});

// ── Assessments ─────────────────────────────────────────────────────

export const createAssessmentSchema = z.object({
  moduleId: id("module"),
  title: text("Title", 160),
  kind: z.enum(["PRACTICE", "GRADED"], { error: "Select a kind" }),
});

export const assessmentSettingsSchema = z.object({
  title: text("Title", 160),
  kind: z.enum(["PRACTICE", "GRADED"], { error: "Select a kind" }),
  timeLimitMins: optionalInt("Time limit", 1, 600),
  passingScorePercent: optionalInt("Passing score", 0, 100),
  allowedAttempts: requiredInt("Allowed attempts", 0, 20),
  shuffleQuestions: checkbox,
  showResultsImmediately: checkbox,
});

export const assessmentStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTIONS = 6;

/** `optionTexts` / `correctIndex` come from the repeated option inputs —
 * see parseQuestionForm. Rules per type are enforced in the refine, so the
 * client can't post a multiple-choice question with no correct answer. */
export const questionSchema = z
  .object({
    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "CODE_SNIPPET"], { error: "Select a question type" }),
    text: text("Question text", 2000),
    points: requiredInt("Marks", 1, 100),
    explanation: optionalText("Explanation", 2000),
    optionTexts: z.array(z.string().trim().max(500, "An option must be at most 500 characters")),
    correctIndex: z.number().int().optional(),
  })
  .superRefine((question, context) => {
    if (question.type === "CODE_SNIPPET") return;
    const required = question.type === "TRUE_FALSE" ? 2 : MIN_CHOICE_OPTIONS;
    if (question.optionTexts.some((option) => option.length === 0)) {
      context.addIssue({ code: "custom", message: "Every option needs text", path: ["optionTexts"] });
    }
    if (question.optionTexts.length < required) {
      context.addIssue({ code: "custom", message: `Add at least ${required} options`, path: ["optionTexts"] });
    }
    if (question.optionTexts.length > MAX_CHOICE_OPTIONS) {
      context.addIssue({ code: "custom", message: `At most ${MAX_CHOICE_OPTIONS} options`, path: ["optionTexts"] });
    }
    if (
      question.correctIndex === undefined ||
      question.correctIndex < 0 ||
      question.correctIndex >= question.optionTexts.length
    ) {
      context.addIssue({ code: "custom", message: "Select the correct answer", path: ["correctIndex"] });
    }
  });

export type QuestionInput = z.infer<typeof questionSchema>;

/** Reads the question dialog's FormData: `optionText` repeats once per
 * option row, `correct` is the index of the chosen radio. A true/false
 * question has no option inputs — its two options are fixed here. */
export function parseQuestionForm(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  const correctRaw = formData.get("correct");
  const correctIndex = correctRaw === null || correctRaw === "" ? undefined : Number(correctRaw);
  const optionTexts =
    type === "TRUE_FALSE"
      ? ["True", "False"]
      : type === "CODE_SNIPPET"
        ? []
        : formData.getAll("optionText").map((value) => String(value));
  return questionSchema.safeParse({
    type,
    text: formData.get("text"),
    points: formData.get("points"),
    explanation: formData.get("explanation") ?? "",
    optionTexts,
    correctIndex: Number.isInteger(correctIndex) ? correctIndex : undefined,
  });
}

// ── Notifications ───────────────────────────────────────────────────

export const announcementSchema = z
  .object({
    audience: z.enum(["all", "program", "batch"], { error: "Choose who receives this" }),
    programId: optionalText("Program", 60),
    batchId: optionalText("Batch", 60),
    title: text("Title", 120),
    body: text("Message", 2000),
  })
  .refine((announcement) => announcement.audience !== "program" || announcement.programId !== undefined, {
    message: "Select a program",
    path: ["programId"],
  })
  .refine((announcement) => announcement.audience !== "batch" || announcement.batchId !== undefined, {
    message: "Select a batch",
    path: ["batchId"],
  });

/** First Zod issue as the action's error string. */
export function firstIssue(error: z.ZodError, fallback = "Invalid input."): string {
  return error.issues[0]?.message ?? fallback;
}
