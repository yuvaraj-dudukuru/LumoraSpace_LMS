import { z } from "zod";

export const saveAnswerSchema = z
  .object({
    selectedOptionId: z.string().min(1).optional(),
    freeTextAnswer: z.string().max(20_000).optional(),
  })
  .refine((data) => data.selectedOptionId !== undefined || data.freeTextAnswer !== undefined, {
    message: "An answer must include a selected option or free text.",
  });

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
