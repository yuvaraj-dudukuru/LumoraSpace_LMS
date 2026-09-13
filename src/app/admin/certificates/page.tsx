import Link from "next/link";
import { Search } from "lucide-react";
import type { CertificateStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getCertificatesForAdmin } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";

const STATUS_TABS: { value: CertificateStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "VALID", label: "Valid" },
  { value: "REVOKED", label: "Revoked" },
];

const STATUS_STYLES: Record<string, string> = {
  VALID: "bg-success-container text-success",
  REVOKED: "bg-error-container text-on-error-container",
};

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status: CertificateStatus | "all" = STATUS_TABS.some((tab) => tab.value === params.status)
    ? (params.status as CertificateStatus | "all")
    : "all";
  const search = params.search?.trim() || undefined;

  const certificates = await getCertificatesForAdmin({ status, search });

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Certificates
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          Certificates issued automatically on program completion.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex flex-wrap gap-sm">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/admin/certificates" : `/admin/certificates?status=${tab.value}`}
              className={`rounded-full px-lg py-sm font-label-md text-label-md transition-colors ${
                status === tab.value
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <form method="GET" action="/admin/certificates" className="flex items-center gap-sm">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-md top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search number or learner..."
              className="w-full rounded-lg border border-outline-variant bg-surface py-sm pl-2xl pr-md font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 sm:w-72"
            />
          </div>
        </form>
      </div>

      {certificates.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2xl text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {search ? `No certificates match "${search}".` : "No certificates issued yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant/40">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Certificate</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Learner</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Program</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Issued</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant">Status</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((certificate) => (
                <tr key={certificate.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="p-md align-top">
                    <Link
                      href={`/admin/certificates/${certificate.id}`}
                      className="font-label-md text-label-md text-on-surface hover:underline"
                    >
                      {certificate.certificateNumber}
                    </Link>
                  </td>
                  <td className="p-md align-top font-label-sm text-label-sm text-on-surface-variant">
                    {certificate.learnerName}
                  </td>
                  <td className="p-md align-top font-label-sm text-label-sm text-on-surface-variant">
                    {certificate.programName}
                  </td>
                  <td className="p-md align-top font-label-sm text-label-sm text-on-surface-variant">
                    {formatDate(certificate.issuedAt)}
                  </td>
                  <td className="p-md align-top">
                    <span
                      className={`rounded-full px-md py-xs font-label-sm text-label-sm ${STATUS_STYLES[certificate.status]}`}
                    >
                      {certificate.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
