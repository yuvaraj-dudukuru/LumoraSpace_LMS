import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getCertificateDetailForAdmin } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { RevokeForm } from "./revoke-form";

export default async function AdminCertificateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const certificate = await getCertificateDetailForAdmin(id);
  if (!certificate) notFound();

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="flex flex-col gap-sm">
          <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
            {certificate.certificateNumber}
          </h1>
          <Link
            href={`/verify/${certificate.certificateNumber}`}
            target="_blank"
            className="flex items-center gap-xs font-label-md text-label-md text-primary hover:underline"
          >
            View public verification page <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        {certificate.status === "VALID" ? <RevokeForm certificateId={certificate.id} /> : null}
      </header>

      <section className="flex flex-col gap-md rounded-xl border border-outline-variant/40 bg-surface-container-low p-lg">
        <div className="flex items-center gap-md">
          {certificate.status === "VALID" ? (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-container">
              <ShieldCheck className="h-6 w-6 text-success" />
            </span>
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container">
              <ShieldAlert className="h-6 w-6 text-error" />
            </span>
          )}
          <div>
            <p className="font-title-lg text-title-lg text-on-surface">{certificate.status}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Issued {formatDate(certificate.issuedAt)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div>
            <dt className="font-label-sm text-label-sm text-on-surface-variant">Learner</dt>
            <dd className="font-body-md text-body-md text-on-surface">{certificate.learnerName}</dd>
            <dd className="font-label-sm text-label-sm text-on-surface-variant">{certificate.learnerEmail}</dd>
          </div>
          <div>
            <dt className="font-label-sm text-label-sm text-on-surface-variant">Program</dt>
            <dd className="font-body-md text-body-md text-on-surface">{certificate.programName}</dd>
          </div>
        </dl>

        {certificate.status === "REVOKED" ? (
          <div className="rounded-lg bg-error-container/40 p-md">
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              Revoked {certificate.revokedAt ? formatDate(certificate.revokedAt) : ""}
            </p>
            <p className="font-body-md text-body-md text-on-surface">{certificate.revokedReason}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
