import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { getCertificateForVerification } from "@/lib/queries/certificates";
import { formatDate } from "@/lib/format";

// PUBLIC route — no auth, no /learn AppShell chrome. Only ever renders
// learnerName/programName/issuedAt/status (see getCertificateForVerification):
// never email, userId, batch, or enrollment internals. Not-found and REVOKED
// both render a plain negative-result panel below, never notFound()/a 404.
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const { certificateNumber } = await params;
  const certificate = await getCertificateForVerification(certificateNumber);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-outline-variant/30">
        <div className="mx-auto flex h-16 max-w-container-max items-center px-margin-mobile lg:px-lg">
          <Link href="/" className="font-headline-md text-title-lg text-on-surface">
            LumoraSpace
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-md">
        <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2xl text-center">
          <p className="mb-lg font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
            Certificate Verification
          </p>

          {!certificate ? (
            <NotFoundResult certificateNumber={certificateNumber} />
          ) : certificate.status === "REVOKED" ? (
            <RevokedResult certificate={certificate} />
          ) : (
            <ValidResult certificate={certificate} />
          )}

          <p className="mt-xl font-label-sm text-label-sm text-on-surface-variant">{certificateNumber}</p>
        </div>
      </main>
    </div>
  );
}

function ValidResult({ certificate }: { certificate: { learnerName: string; programName: string; issuedAt: Date } }) {
  return (
    <div className="flex flex-col items-center gap-md">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container">
        <ShieldCheck className="h-7 w-7 text-success" />
      </span>
      <h1 className="font-headline-md text-headline-md text-on-surface">Certificate Verified</h1>
      <div className="flex flex-col gap-xs">
        <p className="font-display-lg-mobile text-display-lg-mobile text-on-surface">{certificate.learnerName}</p>
        <p className="font-body-lg text-body-lg text-on-surface-variant">{certificate.programName}</p>
      </div>
      <p className="font-label-md text-label-md text-on-surface-variant">
        Issued {formatDate(certificate.issuedAt)}
      </p>
    </div>
  );
}

function RevokedResult({ certificate }: { certificate: { learnerName: string; programName: string; issuedAt: Date } }) {
  return (
    <div className="flex flex-col items-center gap-md">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-error-container">
        <ShieldAlert className="h-7 w-7 text-error" />
      </span>
      <h1 className="font-headline-md text-headline-md text-on-surface">Certificate Revoked</h1>
      <div className="flex flex-col gap-xs">
        <p className="font-title-lg text-title-lg text-on-surface">{certificate.learnerName}</p>
        <p className="font-body-md text-body-md text-on-surface-variant">{certificate.programName}</p>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant">
        This certificate is no longer valid and cannot be verified.
      </p>
    </div>
  );
}

function NotFoundResult({ certificateNumber }: { certificateNumber: string }) {
  return (
    <div className="flex flex-col items-center gap-md">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container">
        <ShieldQuestion className="h-7 w-7 text-on-surface-variant" />
      </span>
      <h1 className="font-headline-md text-headline-md text-on-surface">No Certificate Found</h1>
      <p className="max-w-xs font-body-md text-body-md text-on-surface-variant">
        We couldn&apos;t find a certificate matching &ldquo;{certificateNumber}&rdquo;. Double-check the ID and try
        again.
      </p>
    </div>
  );
}
