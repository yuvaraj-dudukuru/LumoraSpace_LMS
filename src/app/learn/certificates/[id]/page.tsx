import { notFound, forbidden } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth-guards";
import { getCertificateDetailForUser } from "@/lib/queries/certificates";
import { formatDate } from "@/lib/format";

export default async function CertificateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const certificate = await getCertificateDetailForUser(id);
  if (!certificate) notFound();
  if (certificate.userId !== user.id) forbidden();

  const isRevoked = certificate.status === "REVOKED";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-lg">
      <Link
        href="/learn/certificates"
        className="flex items-center gap-xs font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Certificates
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{certificate.program.name}</h1>
          <p className="font-label-md text-label-md text-on-surface-variant">{certificate.certificateNumber}</p>
        </div>
        <span
          className={`flex items-center gap-xs rounded-full px-md py-xs font-label-md text-label-md ${
            isRevoked ? "bg-error-container text-on-error-container" : "bg-success-container text-success"
          }`}
        >
          {isRevoked ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          {isRevoked ? "Revoked" : "Valid"}
        </span>
      </div>

      {isRevoked ? (
        <div className="rounded-xl bg-error-container p-md font-body-md text-body-md text-on-error-container">
          This certificate was revoked{certificate.revokedAt ? ` on ${formatDate(certificate.revokedAt)}` : ""}
          {certificate.revokedReason ? `: ${certificate.revokedReason}` : "."}
        </div>
      ) : null}

      {/* Certificate visual — built from our own components/tokens, not copied
          from the Stitch reference (design/stitch/certificate_detail_lum_2026_00124). */}
      <div className="rounded-2xl border-4 border-double border-primary/30 bg-surface p-2xl text-center shadow-sm">
        <p className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
          LumoraSpace
        </p>
        <h2 className="mt-lg font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Certificate of Completion
        </h2>
        <p className="mt-lg font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
          This is to certify that
        </p>
        <p className="mt-sm font-display-lg-mobile text-display-lg-mobile italic text-primary">
          {user.name}
        </p>
        <p className="mt-lg font-body-lg text-body-lg text-on-surface-variant">has successfully completed</p>
        <p className="mt-xs font-headline-md text-headline-md text-on-surface">{certificate.program.name}</p>

        <div className="mt-2xl flex items-center justify-between border-t border-outline-variant/30 pt-lg text-left">
          <div>
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Date Issued</p>
            <p className="font-label-md text-label-md text-on-surface">{formatDate(certificate.issuedAt)}</p>
          </div>
          <div className="text-right">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">Certificate ID</p>
            <p className="font-label-md text-label-md text-on-surface">{certificate.certificateNumber}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
