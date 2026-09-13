import { z } from "zod";

// Shared by the upload-url action, the client upload component (accept attr +
// pre-check), and submitAssignmentSchema below — one source of truth.
export const ALLOWED_UPLOAD_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
] as const;
export type AllowedUploadFileType = (typeof ALLOWED_UPLOAD_FILE_TYPES)[number];

export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const getUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1, "A file name is required").max(255),
  fileType: z.enum(ALLOWED_UPLOAD_FILE_TYPES),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_FILE_SIZE_BYTES, "File must be 10MB or smaller"),
});

export const submitAssignmentSchema = z
  .object({
    githubUrl: z.string().url().startsWith("https://", "GitHub URL must start with https://").optional(),
    notes: z.string().max(10_000).optional(),
    fileUrl: z.string().url().optional(),
  })
  .refine((data) => data.githubUrl !== undefined || data.notes !== undefined || data.fileUrl !== undefined, {
    message: "Provide a GitHub URL, an uploaded file, or notes describing your submission.",
  });

export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
