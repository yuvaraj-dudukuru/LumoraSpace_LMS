import "server-only";
import { getPresignedDownloadUrl, storageKeyFromUrl } from "@/lib/storage";

const UUID_PREFIX_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

export type SubmissionFileLink =
  | { kind: "ready"; href: string; fileName: string }
  | { kind: "unavailable"; fileName: string };

function displayNameFromKey(key: string): string {
  const last = key.split("/").pop() ?? key;
  return last.replace(UUID_PREFIX_PATTERN, "") || last;
}

/** Turns a stored Submission.fileUrl into something a page can render —
 * generated SERVER-SIDE at render time, and only ever called AFTER the
 * page's own guard (requireMentorForBatch / the learner ownership check)
 * has passed, so the 5-minute presigned GET is never minted for someone
 * who isn't allowed to see the submission.
 *
 * - Our bucket → presigned GET (the object itself is private on R2).
 * - Presigning fails (storage not configured for this deployment, network)
 *   → "unavailable" with the file name, never a crashed page.
 * - A URL that isn't on our bucket at all (the seed's placeholder
 *   storage.lumoraspace.dev links) → rendered as-is; there is no object of
 *   ours to presign. Only the seed can produce such a row: submitAssignment
 *   rejects any off-bucket fileUrl via isKnownStorageUrl.
 * - null in → null out. */
export async function getSubmissionFileLink(fileUrl: string | null): Promise<SubmissionFileLink | null> {
  if (!fileUrl) return null;

  const key = storageKeyFromUrl(fileUrl);
  if (!key) {
    const fileName = fileUrl.split("/").pop() || "Attached file";
    return { kind: "ready", href: fileUrl, fileName };
  }

  const fileName = displayNameFromKey(key);
  try {
    const href = await getPresignedDownloadUrl(key);
    return { kind: "ready", href, fileName };
  } catch (error) {
    console.error("[submission-file] could not presign download URL", { key, error });
    return { kind: "unavailable", fileName };
  }
}
