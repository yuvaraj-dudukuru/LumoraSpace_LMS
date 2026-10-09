import type {
  AccessState,
  AssessmentKind,
  BatchStatus,
  CertificateStatus,
  ContentStatus,
  EnrollmentStatus,
  LessonType,
  ProgramLevel,
  QuestionType,
  Role,
  UserStatus,
} from "@prisma/client";
import type { PillTone } from "./ui";

/** One label + pill tone per enum value, so every admin screen names and
 * colours a status the same way. */
type Display = { label: string; tone: PillTone };

export const BATCH_STATUS: Record<BatchStatus, Display> = {
  UPCOMING: { label: "Upcoming", tone: "secondary" },
  ACTIVE: { label: "Active", tone: "primary" },
  COMPLETED: { label: "Completed", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

export const CONTENT_STATUS: Record<ContentStatus, Display> = {
  PUBLISHED: { label: "Published", tone: "primary" },
  DRAFT: { label: "Draft", tone: "secondary" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

export const ENROLLMENT_STATUS: Record<EnrollmentStatus, Display> = {
  ACTIVE: { label: "Active", tone: "primary" },
  COMPLETED: { label: "Completed", tone: "success" },
  PENDING: { label: "Pending", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "error" },
  DROPPED: { label: "Dropped", tone: "error" },
};

export const ACCESS_STATE: Record<AccessState, Display> = {
  GRANTED: { label: "Granted", tone: "primary" },
  AWAITING: { label: "Awaiting", tone: "warning" },
  SUSPENDED: { label: "Suspended", tone: "error" },
};

export const USER_STATUS: Record<UserStatus, Display> = {
  ACTIVE: { label: "Active", tone: "primary" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};

export const CERTIFICATE_STATUS: Record<CertificateStatus, Display> = {
  VALID: { label: "Valid", tone: "success" },
  REVOKED: { label: "Revoked", tone: "error" },
};

export const ROLE_LABEL: Record<Role, string> = { LEARNER: "Learner", MENTOR: "Mentor", ADMIN: "Admin" };

export const LEVEL_LABEL: Record<ProgramLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const LESSON_TYPE_LABEL: Record<LessonType, string> = { VIDEO: "Video", READING: "Reading", QUIZ: "Quiz" };

export const ASSESSMENT_KIND_LABEL: Record<AssessmentKind, string> = { PRACTICE: "Practice", GRADED: "Graded" };

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple Choice",
  TRUE_FALSE: "True / False",
  CODE_SNIPPET: "Code Snippet",
};

/** yyyy-mm-dd for <input type="date" defaultValue>. */
export function dateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "Sep 10 - Dec 20, 2026" (year once when both dates share it). */
export function formatDateRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endText = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startText} - ${endText}`;
}
