"use server";

import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { resolveAssignmentProgram } from "@/lib/queries/assignments";
import { getUploadUrlSchema } from "@/lib/validations/assignment";
import { getPresignedUploadUrl } from "@/lib/storage";

export type GetAssignmentUploadUrlResult =
  | { ok: true; uploadUrl: string; publicUrl: string }
  | { ok: false; error: string };

/** assignmentId is attacker-controlled — re-resolves its program and
 * re-verifies a granted enrollment server-side, same pattern as
 * submitAssignment ([assignmentId]/actions.ts). Never trusts the client's
 * claimed fileType/fileSize without re-validating them here — the presigned
 * URL itself binds ContentType/ContentLength to whatever validated values
 * are passed to getPresignedUploadUrl (see storage.ts). */
export async function getAssignmentUploadUrl(
  assignmentId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<GetAssignmentUploadUrlResult> {
  const resolved = await resolveAssignmentProgram(assignmentId);
  if (!resolved) return { ok: false, error: "Assignment not found." };

  await requireGrantedEnrollment(resolved.programId);

  const parsed = getUploadUrlSchema.safeParse({ fileName, fileType, fileSize });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file." };
  }

  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
    parsed.data.fileName,
    parsed.data.fileType,
    parsed.data.fileSize,
  );

  return { ok: true, uploadUrl, publicUrl };
}
