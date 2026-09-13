"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { revokeCertificateSchema } from "@/lib/validations/admin";

export type CertificateActionResult = { ok: true } | { ok: false; error: string };

/** /verify/[certificateNumber] reads Certificate.status directly from the DB
 * (getCertificateForVerification) — no changes needed there, it reflects
 * this immediately. */
export async function revokeCertificate(id: string, input: { reason: string }): Promise<CertificateActionResult> {
  await requireRole("ADMIN");

  const parsed = revokeCertificateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "A reason is required." };

  const certificate = await prisma.certificate.findUnique({ where: { id } });
  if (!certificate) return { ok: false, error: "Certificate not found." };
  if (certificate.status === "REVOKED") return { ok: true }; // idempotent

  await prisma.certificate.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: parsed.data.reason },
  });

  revalidatePath(`/admin/certificates/${id}`);
  revalidatePath("/admin/certificates");
  revalidatePath("/admin");
  return { ok: true };
}
