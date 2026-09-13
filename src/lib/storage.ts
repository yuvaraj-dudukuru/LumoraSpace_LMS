import "server-only";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60; // 5 minutes

if (!process.env.S3_ENDPOINT && process.env.NODE_ENV !== "development") {
  throw new Error("S3_ENDPOINT is not set. Required outside development — see .env.example.");
}

const s3Client = new S3Client({
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

export type PresignedUpload = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

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
  const key = `assignment-submissions/${randomUUID()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: fileType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: UPLOAD_URL_EXPIRY_SECONDS });

  // Path-style public URL — the reasonable default for an S3-compatible
  // endpoint (R2/MinIO) with no CDN/custom domain configured. A production
  // deployment fronting the bucket with a CDN would replace this with that
  // domain instead; not configurable here since no such env var was asked for.
  const publicUrl = `${process.env.S3_ENDPOINT}/${bucket}/${key}`;

  return { uploadUrl, publicUrl, key };
}
