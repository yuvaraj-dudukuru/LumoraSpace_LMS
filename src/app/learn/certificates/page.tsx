import Link from "next/link";
import { Award, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth-guards";
import { getCertificatesForUser } from "@/lib/queries/certificates";
import { formatDate } from "@/lib/format";

export default async function CertificatesPage() {
  const user = await requireUser();
  const certificates = await getCertificatesForUser(user.id);

  return (
    <div className="flex flex-col gap-xl">
      <header>
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Certificates
        </h1>
        <p className="mt-sm font-body-lg text-body-lg text-on-surface-variant">
          Credentials you&apos;ve earned by completing a program.
        </p>
      </header>

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center gap-lg rounded-2xl bg-surface-container-low p-3xl text-center">
          <Award className="h-12 w-12 text-on-surface-variant" />
          <h2 className="font-headline-md text-headline-md text-on-surface">No Certificates Yet</h2>
          <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
            Complete a program to earn your first certificate — it will show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-md">
          {certificates.map((certificate) => (
            <li key={certificate.id}>
              <Link
                href={`/learn/certificates/${certificate.id}`}
                className="group flex items-center gap-lg rounded-xl bg-surface-container-low p-lg transition-colors hover:bg-surface-container"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                  <Award className="h-7 w-7 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {certificate.certificateNumber}
                    </span>
                    <span
                      className={`rounded-full px-sm py-xs font-label-sm text-label-sm ${
                        certificate.status === "VALID"
                          ? "bg-success-container text-success"
                          : "bg-error-container text-on-error-container"
                      }`}
                    >
                      {certificate.status === "VALID" ? "Valid" : "Revoked"}
                    </span>
                  </div>
                  <h3 className="mt-xs font-title-lg text-title-lg text-on-surface transition-colors group-hover:text-primary">
                    {certificate.program.name}
                  </h3>
                  <p className="font-label-md text-label-md text-on-surface-variant">
                    Issued {formatDate(certificate.issuedAt)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-on-surface-variant" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
