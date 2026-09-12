import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const certificateSelect = {
  id: true,
  certificateNumber: true,
  templateName: true,
  status: true,
  issuedAt: true,
  program: { select: { id: true, name: true } },
} satisfies Prisma.CertificateSelect;

export type LearnerCertificate = Prisma.CertificateGetPayload<{ select: typeof certificateSelect }>;

export async function getCertificatesForUser(userId: string): Promise<LearnerCertificate[]> {
  return prisma.certificate.findMany({
    where: { userId },
    select: certificateSelect,
    orderBy: { issuedAt: "desc" },
  });
}
