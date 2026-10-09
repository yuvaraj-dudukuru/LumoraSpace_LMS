import Link from "next/link";
import { Award, BadgeCheck, ClipboardList, LayoutTemplate, ShieldCheck, ShieldX } from "lucide-react";
import type { CertificateStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getCertificateOverview, getCertificatesForAdmin } from "@/lib/queries/admin";
import { getProgramOptions } from "@/lib/queries/admin-options";
import { buildHref, paginate } from "@/lib/pagination";
import { formatDate } from "@/lib/format";
import { ActionButton } from "@/components/admin/action-button";
import { CERTIFICATE_STATUS } from "@/components/admin/status";
import { Avatar, EmptyState, FilterSelect, FilterTabs, Pagination, Panel, SearchForm, StatCard, StatusPill, TH } from "@/components/admin/ui";
import { issueCertificate } from "./actions";

type Tab = "overview" | "issued" | "eligibility";

const STATUS_TABS: { value: CertificateStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "VALID", label: "Valid" },
  { value: "REVOKED", label: "Revoked" },
];

const RECENT_LIMIT = 6;

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; program?: string; search?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status: CertificateStatus | "all" = STATUS_TABS.some((option) => option.value === params.status)
    ? (params.status as CertificateStatus | "all")
    : "all";
  const search = params.search?.trim() || undefined;
  // A search or filter from anywhere lands on the Issued tab, where the full table is.
  const tab: Tab =
    params.tab === "eligibility"
      ? "eligibility"
      : params.tab === "issued" || search || params.status || params.program
        ? "issued"
        : "overview";

  const programOptions = await getProgramOptions();
  const programId = programOptions.some((option) => option.value === params.program) ? params.program : undefined;

  const [overview, certificates] = await Promise.all([
    getCertificateOverview(),
    getCertificatesForAdmin(tab === "issued" ? { status, search, programId } : {}),
  ]);
  const page = paginate(certificates, params.page);
  const issuedHref = (next: { status?: CertificateStatus | "all"; page?: number }) =>
    buildHref(
      "/admin/certificates",
      { tab: "issued", status: next.status ?? status, program: programId, search, page: next.page },
      { status: "all", page: 1 },
    );

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <p className="flex items-center gap-sm font-label-md text-label-md uppercase tracking-widest text-secondary">
          <BadgeCheck className="h-4 w-4" /> Credential Management
        </p>
        <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
          Certificates
        </h1>
        <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          Track issued credentials, see who is eligible, and revoke when needed.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Issued" value={overview.issued} icon={<Award className="h-4 w-4 text-primary" />} href="/admin/certificates?tab=issued" />
        <StatCard
          label="Pending"
          value={overview.eligible.length}
          icon={<ClipboardList className="h-4 w-4 text-secondary" />}
          hint="Eligible, not yet issued"
          href="/admin/certificates?tab=eligibility"
        />
        <StatCard
          label="Revoked"
          value={overview.revoked}
          icon={<ShieldX className="h-4 w-4 text-error" />}
          href="/admin/certificates?tab=issued&status=REVOKED"
        />
        <StatCard label="Templates" value={overview.templates} icon={<LayoutTemplate className="h-4 w-4 text-primary" />} />
      </div>

      <nav aria-label="Certificate sections" className="flex gap-lg overflow-x-auto border-b border-outline-variant">
        {(
          [
            { value: "overview", label: "Overview", href: "/admin/certificates" },
            { value: "issued", label: "Issued Certificates", href: "/admin/certificates?tab=issued" },
            { value: "eligibility", label: "Eligibility", href: "/admin/certificates?tab=eligibility" },
          ] as const
        ).map((item) => (
          <Link
            key={item.value}
            href={item.href}
            aria-current={tab === item.value ? "true" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 pb-sm font-body-lg text-body-lg transition-colors ${
              tab === item.value ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
          <div className="flex flex-col gap-lg">
            <section className="flex flex-col gap-md rounded-2xl bg-surface-container-low p-lg">
              <h2 className="flex items-center justify-between font-title-lg text-title-lg text-on-surface">
                Active Template
                <span className="rounded-full bg-primary-fixed px-md py-xs font-label-md text-label-md text-primary">Standard</span>
              </h2>
              {/* A schematic of the certificate layout, not a rendered certificate. */}
              <div aria-hidden="true" className="flex aspect-video flex-col items-center justify-center gap-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <span className="h-2 w-1/2 rounded-full bg-surface-container-highest" />
                <span className="h-2 w-1/3 rounded-full bg-surface-container-highest" />
                <span className="mt-sm h-1.5 w-2/3 rounded-full bg-surface-container" />
                <span className="h-1.5 w-1/2 rounded-full bg-surface-container" />
              </div>
              <p className="font-label-md text-label-md text-on-surface-variant">
                Every certificate uses the Standard layout. Open any issued certificate to see it filled in.
              </p>
            </section>

            <EligibilityRule />
          </div>

          <Panel className="overflow-hidden lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-md p-lg">
              <div>
                <h2 className="font-title-lg text-title-lg text-on-surface">Recently Issued</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">Latest credentials across all programs.</p>
              </div>
              <SearchForm action="/admin/certificates" placeholder="Search ID or name" hidden={{ tab: "issued" }} />
            </div>
            {certificates.length === 0 ? (
              <p className="p-lg pt-0 font-body-md text-body-md text-on-surface-variant">No certificates have been issued yet.</p>
            ) : (
              <>
                <CertificateTable rows={certificates.slice(0, RECENT_LIMIT)} />
                {certificates.length > RECENT_LIMIT ? (
                  <p className="border-t border-outline-variant/40 p-md">
                    <Link href="/admin/certificates?tab=issued" className="font-label-md text-label-md text-primary hover:underline">
                      View all {certificates.length} certificates
                    </Link>
                  </p>
                ) : null}
              </>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "issued" ? (
        <Panel className="flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-md p-lg">
            <SearchForm
              action="/admin/certificates"
              placeholder="Search by ID or learner..."
              defaultValue={search}
              hidden={{ tab: "issued", status: status === "all" ? undefined : status, program: programId }}
            />
            <div className="flex flex-wrap items-center gap-md">
              <FilterTabs
                label="Certificate status"
                variant="segment"
                tabs={STATUS_TABS.map((option) => ({
                  label: option.label,
                  href: issuedHref({ status: option.value }),
                  active: status === option.value,
                }))}
              />
              <FilterSelect
                action="/admin/certificates"
                name="program"
                label="Program"
                value={programId ?? ""}
                options={[{ value: "", label: "All programs" }, ...programOptions]}
                hidden={{ tab: "issued", status: status === "all" ? undefined : status, search }}
              />
            </div>
          </div>
          {page.total === 0 ? (
            <div className="p-lg pt-0">
              <EmptyState icon={<Award className="h-10 w-10 text-on-surface-variant" />}>
                {search ? `No certificates match "${search}".` : "No certificates match this filter."}
              </EmptyState>
            </div>
          ) : (
            <>
              <CertificateTable rows={page.rows} />
              <Pagination {...page} noun="certificates" hrefFor={(next) => issuedHref({ page: next })} />
            </>
          )}
        </Panel>
      ) : null}

      {tab === "eligibility" ? (
        <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
          <EligibilityRule />
          <Panel className="overflow-hidden lg:col-span-2">
            <div className="p-lg">
              <h2 className="font-title-lg text-title-lg text-on-surface">Eligible, Not Yet Issued</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Learners at 100% with no certificate. Completing the last lesson issues one automatically, so this list is
                normally empty — it fills only when a curriculum change brings someone to 100%.
              </p>
            </div>
            {overview.eligible.length === 0 ? (
              <p className="p-lg pt-0 font-body-md text-body-md text-on-surface-variant">No one is waiting for a certificate.</p>
            ) : (
              <ul>
                {overview.eligible.map((row) => (
                  <li key={row.enrollmentId} className="flex flex-wrap items-center gap-md border-t border-outline-variant/30 p-md">
                    <Avatar name={row.learnerName} />
                    <Link href={`/admin/users/${row.userId}`} className="flex min-w-0 flex-1 flex-col hover:text-primary">
                      <span className="truncate font-body-md text-body-md text-on-surface">{row.learnerName}</span>
                      <span className="truncate font-label-md text-label-md text-on-surface-variant">
                        {row.programName}
                        {row.batchName ? ` · ${row.batchName}` : ""}
                      </span>
                    </Link>
                    <ActionButton
                      action={issueCertificate.bind(null, row.enrollmentId)}
                      variant="primary"
                      pendingLabel="Issuing..."
                      confirm={`Issue a certificate to ${row.learnerName}?`}
                      confirmLabel="Issue"
                    >
                      Issue Certificate
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

/** The gate that actually decides issuance today (src/lib/certificates.ts). */
function EligibilityRule() {
  return (
    <section className="flex flex-col gap-md rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg">
      <h2 className="flex items-center gap-sm font-title-lg text-title-lg text-on-surface">
        <ShieldCheck className="h-5 w-5 text-primary" /> Eligibility Gates
      </h2>
      <ul className="flex flex-col gap-md border-t border-outline-variant/40 pt-md">
        <li className="flex items-start gap-md">
          <span className="mt-xs flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-on-primary" aria-hidden="true">
            <BadgeCheck className="h-3.5 w-3.5" />
          </span>
          <span className="flex flex-col">
            <span className="font-body-md text-body-md text-on-surface">Program Completion</span>
            <span className="font-label-md text-label-md text-on-surface-variant">
              Required. Every lesson in every published module is complete (quiz lessons by passing their assessment).
            </span>
          </span>
        </li>
      </ul>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        This is the only gate in force. A revoked certificate is never re-issued automatically.
      </p>
    </section>
  );
}

function CertificateTable({ rows }: { rows: Awaited<ReturnType<typeof getCertificatesForAdmin>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-outline-variant/40">
            <th className={TH}>Certificate ID</th>
            <th className={TH}>Recipient</th>
            <th className={TH}>Program</th>
            <th className={TH}>Issue Date</th>
            <th className={TH}>Status</th>
            <th className={TH}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((certificate) => (
            <tr key={certificate.id} className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low">
              <td className="whitespace-nowrap p-md font-mono font-label-md text-label-md text-on-surface">
                <Link href={`/admin/certificates/${certificate.id}`} className="hover:text-primary hover:underline">
                  {certificate.certificateNumber}
                </Link>
              </td>
              <td className="p-md">
                <div className="flex items-center gap-md">
                  <Avatar name={certificate.learnerName} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-body-md text-body-md text-on-surface">{certificate.learnerName}</span>
                    <span className="truncate font-label-sm text-label-sm text-on-surface-variant">{certificate.learnerEmail}</span>
                  </div>
                </div>
              </td>
              <td className="p-md font-body-md text-body-md text-on-surface-variant">
                {certificate.programName}
                {certificate.batchName ? <span className="block font-label-sm text-label-sm">{certificate.batchName}</span> : null}
              </td>
              <td className="whitespace-nowrap p-md font-body-md text-body-md text-on-surface-variant">{formatDate(certificate.issuedAt)}</td>
              <td className="p-md">
                <StatusPill tone={CERTIFICATE_STATUS[certificate.status].tone}>{CERTIFICATE_STATUS[certificate.status].label}</StatusPill>
              </td>
              <td className="p-md text-right">
                <Link
                  href={`/admin/certificates/${certificate.id}`}
                  aria-label={`View certificate ${certificate.certificateNumber}`}
                  className="font-label-md text-label-md text-primary hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
