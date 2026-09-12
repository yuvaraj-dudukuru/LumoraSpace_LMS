import { z } from "zod";

export const lessonNotesSchema = z.object({
  notes: z.string().max(10_000),
});

export type LessonNotesInput = z.infer<typeof lessonNotesSchema>;
