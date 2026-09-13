import { z } from "zod";

export const submitAssignmentSchema = z
  .object({
    githubUrl: z.string().url().startsWith("https://", "GitHub URL must start with https://").optional(),
    notes: z.string().max(10_000).optional(),
  })
  .refine((data) => data.githubUrl !== undefined || data.notes !== undefined, {
    message: "Provide a GitHub URL or notes describing your submission.",
  });

export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
