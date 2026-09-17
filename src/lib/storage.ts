import "server-only";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const DOWNLOAD_URL_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const SUBMISSIONS_KEY_PREFIX = "assignment-submissions/";
const MAX_FILE_NAME_LENGTH = 100;
const MAX_EXTENSION_LENGTH = 16;

// All four were previously checked inconsistently — only S3_ENDPOINT threw.
// S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET_NAME silently defaulted to "" instead.
// All four now fail the same way, for the same reason — but see the note on
// getS3Client() below for why this check moved from module scope into a
// lazy getter instead of running here at import time.
const REQUIRED_S3_ENV_VARS = ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET_NAME"] as const;

let cachedClient: S3Client | null = null;

/** True when every REQUIRED S3_* var is present (S3_REGION is optional —
 * it falls back to "auto", which is correct for R2). The assignment page
 * checks this server-side and passes a boolean down so the upload control
 * is only rendered when an upload could actually succeed. */
export function isStorageConfigured(): boolean {
  return REQUIRED_S3_ENV_VARS.every((name) => Boolean(process.env[name]));
}

/** Lazily constructs (and caches) the S3 client on first actual use, rather
 * than throwing at module load. A top-level throw here would fire the
 * moment ANYTHING imports this module — and Next's build "collect page
 * data" step statically evaluates every Server Action's module graph,
 * including this one (reachable from getAssignmentUploadUrl), even for
 * routes nobody is actively hitting. That turned a missing S3 env var at
 * BUILD time into a fatal, whole-page build failure (confirmed: this is
 * exactly what broke `npm run build` for /learn/assignments/[assignmentId]
 * before this fix). Deferring the check to first real call means the same
 * loud error still fires — just at the first actual upload-URL request,
 * not at build time for a page that never runs the function. */
function getS3Client(): S3Client {
  if (cachedClient) return cachedClient;

  if (process.env.NODE_ENV !== "development") {
    const missing = REQUIRED_S3_ENV_VARS.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      throw new Error(`${missing.join(", ")} not set. Required outside development — see .env.example.`);
    }
  }

  cachedClient = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
    // S3-compatible providers (R2, MinIO) serve path-style buckets; AWS itself
    // also accepts this, so it's the safe default for either backend.
    forcePathStyle: true,
  });
  return cachedClient;
}

export type PresignedUpload = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

/** Makes a user-supplied file name safe to embed in an object key AND in
 * the un-encoded public URL we store from it: basename only (no path
 * separators of either flavour), whitespace → "-", everything outside
 * [A-Za-z0-9._-] dropped, ".." collapsed, runs of "-" collapsed, no leading
 * dot/dash, and capped at MAX_FILE_NAME_LENGTH while keeping the extension.
 * Never returns an empty string. */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/^[.\-_]+/, "");
  if (cleaned.length === 0) return "file";
  if (cleaned.length <= MAX_FILE_NAME_LENGTH) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 ? cleaned.slice(dot).slice(0, MAX_EXTENSION_LENGTH) : "";
  return `${cleaned.slice(0, MAX_FILE_NAME_LENGTH - extension.length)}${extension}`;
}

/** `${S3_ENDPOINT}/${bucket}/` — the path-style prefix every stored fileUrl
 * begins with. Null when storage isn't configured (so nothing can ever
 * match a "undefined/undefined/" prefix by accident). */
function storagePublicPrefix(): string | null {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET_NAME;
  if (!endpoint || !bucket) return null;
  return `${endpoint}/${bucket}/`;
}

/** Inverse of the publicUrl built in getPresignedUploadUrl: recovers the
 * object key from a stored Submission.fileUrl, or null when the URL isn't
 * one of ours (wrong endpoint/bucket, outside the submissions prefix, or
 * storage not configured at all). */
export function storageKeyFromUrl(fileUrl: string): string | null {
  const prefix = storagePublicPrefix();
  if (!prefix) return null;
  const submissionsPrefix = `${prefix}${SUBMISSIONS_KEY_PREFIX}`;
  if (!fileUrl.startsWith(submissionsPrefix)) return null;
  const key = fileUrl.slice(prefix.length);
  return key.length > SUBMISSIONS_KEY_PREFIX.length ? key : null;
}

/** Generates a presigned PUT URL valid for 5 minutes.
 *
 * IMPORTANT limitation, not a shortcut: S3 "conditions" (content-length-range,
 * exact Content-Type match, etc.) are a feature of presigned POST policies
 * (createPresignedPost), not presigned PUT URLs — there is no "conditions"
 * array for a single-URL PUT. The closest real equivalent for a PUT is
 * signing specific request headers so S3 rejects any upload that doesn't
 * match them exactly:
 *   - ContentType is signed, so the client's PUT must send this exact
 *     Content-Type header or the request fails at S3 with a signature
 *     mismatch (this is what "enforces Content-Type matching" means here).
 *   - ContentLength is signed to the caller-supplied fileSize (validated
 *     against MAX_UPLOAD_FILE_SIZE_BYTES by the caller before this is ever
 *     invoked — see validations/assignment.ts), so the actual upload must be
 *     exactly that many bytes. Since the caller already rejected anything
 *     over 10MB, binding the signature to that exact, pre-validated size is
 *     what makes the 10MB cap real: the client cannot upload a larger file
 *     under this URL even if it lies after the fact, because any byte-count
 *     mismatch fails the S3 request itself, not just a client-side check. */
export async function getPresignedUploadUrl(
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<PresignedUpload> {
  const bucket = process.env.S3_BUCKET_NAME ?? "";
  const key = `${SUBMISSIONS_KEY_PREFIX}${randomUUID()}-${sanitizeFileName(fileName)}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: fileType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: UPLOAD_URL_EXPIRY_SECONDS });

  // Path-style public URL — the reasonable default for an S3-compatible
  // endpoint (R2/MinIO) with no CDN/custom domain configured. A production
  // deployment fronting the bucket with a CDN would replace this with that
  // domain instead; not configurable here since no such env var was asked for.
  const publicUrl = `${process.env.S3_ENDPOINT}/${bucket}/${key}`;

  return { uploadUrl, publicUrl, key };
}

/** The bucket is private (R2 objects are not publicly readable by default,
 * and nothing here makes them so) — the stored fileUrl is an identifier,
 * not a link anyone can open. Callers that want to let a mentor/learner
 * actually open the file presign a short-lived GET at render time, after
 * their own authorization check has passed. 5-minute expiry, same as the
 * upload URL. Throws (like getPresignedUploadUrl) when storage isn't
 * configured — callers catch and degrade. */
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME ?? "",
    Key: key,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS });
}

/** submitAssignment receives fileUrl straight from the client — never trust
 * that it actually came from a presigned upload this app issued. This is a
 * cheap, real check: does it even point at our bucket? It can't confirm the
 * object was genuinely uploaded (that needs a HEAD request, not done here),
 * but it stops a learner from submitting an arbitrary off-bucket URL as if
 * it were their upload. */
export function isKnownStorageUrl(url: string): boolean {
  return storageKeyFromUrl(url) !== null;
}
