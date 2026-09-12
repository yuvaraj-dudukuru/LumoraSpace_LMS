import { z } from "zod";

export const enrollSchema = z.object({
  batchId: z.string().min(1, "Choose a cohort to continue"),
});

export type EnrollInput = z.infer<typeof enrollSchema>;
