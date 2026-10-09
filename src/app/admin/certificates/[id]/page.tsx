import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getCertificateDetailForAdmin } from "@/lib/queries/admin";
import { formatDate, formatDateTime } from "@/lib/format";
import { CERTIFICATE_STATUS } from "@/components/admin/status";
import { OUTLINE_BUTTON, Panel, StatusPill } from "@/components/admin/ui";
import { RevokeForm } from "./revoke-form";

export default async function AdminCertificateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const certificate = await getCertificateDetailForAdmin(id);
  if (!certificate) notFound();

  const revoked = certificate.status === "REVOKED";
  const history = [
    { label: "Issued", detail: "Issued on program completion.", at: certificate.issuedAt },
    ...(revoked && certificate.revokedAt
      ? [{ label: "Revoked", detail: certificate.revokedReason ?? "No reason recorded.", at: certificate.revokedAt }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-xl">
      <nav aria-label="Breadcrumb" className="flex items-center gap-xs font-label-md text-label-md">
        <Link href="/admin/certificates?tab=issued" className="text-on-surface-variant hover:text-on-surface">
          Certificates
        </Link>
        <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
        <span className="text-on-surface">{certificate.certificateNumber}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-md">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{certificate.certificateNumber}</h1>
            <StatusPill tone={CERTIFICATE_STATUS[certificate.status].tone}>{CERTIFICATE_STATUS[certificate.status].label}</StatusPill>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">Issued {formatDate(certificate.issuedAt)}</p>
        </div>
        <div className="flex flex-wrap items-start gap-sm">
          <Link href={`/verify/${certificate.certificateNumber}`} target="_blank" className={OUTLINE_BUTTON}>
            <ExternalLink className="h-4 w-4" /> Public Verification Page
          </Link>
          {revoked ? null : <RevokeForm certificateId={certificate.id} />}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl">
          <Panel className="flex flex-col gap-md p-lg">
            <h2 className="font-title-lg text-title-lg text-on-surface">Details</h2>
            <dl className="flex flex-col gap-md">
              <Detail label="Certificate ID" value={certificate.certificateNumber} mono />
              <div className="flex flex-col gap-xs">
                <dt className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Learner</dt>
                <dd>
                  <Link href={`/admin/users/${certificate.userId}`} className="font-body-md text-body-md text-on-surface hover:text-primary hover:underline">
                    {certificate.learnerName}
                  </Link>
                  <p className="font-label-md text-label-md text-on-surface-variant">{certificate.learnerEmail}</p>
                </dd>
              </div>
              <Detail label="Program" value={certificate.batchName ? `${certificate.programName} · ${certificate.batchName}` : certificate.programName} />
              <Detail label="Issue Date" value={formatDate(certificate.issuedAt)} />
              <Detail label="Template" value={certificate.templateName} />
            </dl>
          </Panel>

          <Panel className="flex flex-col gap-md p-lg">
            <h2 className="font-title-lg text-title-lg text-on-surface">History</h2>
            <ol className="flex flex-col">
              {history.map((event, index) => (
                <li key={event.label} className="flex gap-md">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-xs h-2.5 w-2.5 shrink-0 rounded-full ${event.label === "Revoked" ? "bg-error" : "bg-primary"}`}
                      aria-hidden="true"
                    />
                    {index < history.length - 1 ? <span className="w-px flex-1 bg-outline-variant/60" aria-hidden="true" /> : null}
                  </div>
                  <div className={`flex flex-col gap-xs ${index < history.length - 1 ? "pb-lg" : ""}`}>
                    <span className="font-label-md text-label-md text-on-surface">{event.label}</span>
                    <span className="font-body-md text-body-md text-on-surface-variant">{event.detail}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{formatDateTime(event.at)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        {/* The certificate as the learner sees it — built from the same four public facts as /verify. */}
        <Panel className="flex items-center justify-center p-lg lg:col-span-2">
          <div
            className={`relative flex w-full max-w-2xl flex-col items-center gap-lg rounded-xl border-4 border-double p-2xl text-center ${
              revoked ? "border-error/40" : "border-primary/40"
            }`}
          >
            {revoked ? (
              <span className="absolute right-md top-md rounded bg-error px-md py-xs font-label-md text-label-md uppercase tracking-widest text-on-error">
                Revoked
              </span>
            ) : null}
            <ShieldCheck className={`h-12 w-12 ${revoked ? "text-on-surface-variant" : "text-primary"}`} aria-hidden="true" />
            <p className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">Certificate of Completion</p>
            <p className="font-body-md text-body-md text-on-surface-variant">This certifies that</p>
            <p className="font-display-lg-mobile text-display-lg-mobile text-on-surface">{certificate.learnerName}</p>
            <p className="font-body-md text-body-md text-on-surface-variant">has successfully completed</p>
            <p className="font-headline-md text-headline-md text-on-surface">{certificate.programName}</p>
            <div className="mt-md flex w-full flex-wrap items-end justify-between gap-md border-t border-outline-variant/60 pt-lg">
              <div className="flex flex-col items-start gap-xs">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Issued</span>
                <span className="font-label-md text-label-md text-on-surface">{formatDate(certificate.issuedAt)}</span>
              </div>
              <span className="font-headline-md text-headline-md text-primary">LumoraSpace</span>
              <div className="flex flex-col items-end gap-xs">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Verification ID</span>
                <span className="font-mono font-label-md text-label-md text-on-surface">{certificate.certificateNumber}</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-xs">
      <dt className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className={`font-body-md text-body-md text-on-surface ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
