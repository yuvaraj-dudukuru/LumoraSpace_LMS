import Link from "next/link";
import { FileQuestion, Plus } from "lucide-react";
import type { ContentStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getAssessmentsForAdmin } from "@/lib/queries/admin-assessments";
import { getModuleOptions, getProgramOptions } from "@/lib/queries/admin-options";
import { buildHref, paginate } from "@/lib/pagination";
import { formatRelativeTime } from "@/lib/format";
import { ModalForm } from "@/components/admin/modal-form";
import { SelectField, TextField } from "@/components/admin/fields";
import { ASSESSMENT_KIND_LABEL, CONTENT_STATUS } from "@/components/admin/status";
import { EmptyState, FilterSelect, FilterTabs, PageHeader, Pagination, Panel, SearchForm, StatCard, StatusPill, TH } from "@/components/admin/ui";
import { createAssessment } from "./actions";

const STATUS_TABS: { value: ContentStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

export default async function AdminAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; program?: string; search?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status: ContentStatus | "all" = STATUS_TABS.some((tab) => tab.value === params.status)
    ? (params.status as ContentStatus | "all")
    : "all";
  const search = params.search?.trim() || undefined;

  const [programOptions, moduleOptions] = await Promise.all([getProgramOptions(), getModuleOptions()]);
  const programId = programOptions.some((option) => option.value === params.program) ? params.program : undefined;

  const { counts, rows } = await getAssessmentsForAdmin({ status, programId, search });
  const page = paginate(rows, params.page);
  const href = (next: { status?: ContentStatus | "all"; page?: number }) =>
    buildHref(
      "/admin/assessments",
      { status: next.status ?? status, program: programId, search, page: next.page },
      { status: "all", page: 1 },
    );

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Assessments" description="Create and manage assessments across LumoraSpace programs.">
        <ModalForm
          trigger={
            <>
              <Plus className="h-4 w-4" /> Create Assessment
            </>
          }
          title="Create Assessment"
          description="Starts as a draft. You'll add questions on the next screen."
          submitLabel="Create Assessment"
          pendingLabel="Creating..."
          action={createAssessment}
        >
          <TextField name="title" label="Title" required maxLength={160} />
          <SelectField
            name="moduleId"
            label="Module"
            required
            placeholder={moduleOptions.length === 0 ? "No modules yet — add one in Curriculum" : "Select a module"}
            options={moduleOptions}
          />
          <SelectField
            name="kind"
            label="Kind"
            required
            defaultValue="PRACTICE"
            hint="Practice: unlimited attempts, shown in the learner practice hub. Graded: counted as pending work until passed."
            options={[
              { value: "PRACTICE", label: "Practice quiz" },
              { value: "GRADED", label: "Graded assessment" },
            ]}
          />
        </ModalForm>
      </PageHeader>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Assessments" value={counts.total} />
        <StatCard label="Published" value={counts.published} href={href({ status: "PUBLISHED" })} />
        <StatCard label="Draft" value={counts.draft} href={href({ status: "DRAFT" })} />
        <StatCard label="Archived" value={counts.archived} href={href({ status: "ARCHIVED" })} />
      </div>

      <Panel className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-md p-lg">
          <SearchForm
            action="/admin/assessments"
            placeholder="Search assessments..."
            defaultValue={search}
            hidden={{ status: status === "all" ? undefined : status, program: programId }}
          />
          <div className="flex flex-wrap items-center gap-md">
            <FilterTabs
              label="Assessment status"
              variant="segment"
              tabs={STATUS_TABS.map((tab) => ({ label: tab.label, href: href({ status: tab.value }), active: status === tab.value }))}
            />
            <FilterSelect
              action="/admin/assessments"
              name="program"
              label="Program"
              value={programId ?? ""}
              options={[{ value: "", label: "All programs" }, ...programOptions]}
              hidden={{ status: status === "all" ? undefined : status, search }}
            />
          </div>
        </div>

        {page.total === 0 ? (
          <div className="p-lg pt-0">
            <EmptyState icon={<FileQuestion className="h-10 w-10 text-on-surface-variant" />}>
              {search ? `No assessments match "${search}".` : "No assessments match this filter."}
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-y border-outline-variant/40">
                    <th className={TH}>Assessment</th>
                    <th className={TH}>Program</th>
                    <th className={TH}>Module</th>
                    <th className={`${TH} text-right`}>Questions</th>
                    <th className={`${TH} text-right`}>Attempts</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Updated</th>
                    <th className={TH}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((assessment) => (
                    <tr
                      key={assessment.id}
                      className={`border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low ${assessment.status === "ARCHIVED" ? "opacity-70" : ""}`}
                    >
                      <td className="p-md">
                        <div className="flex items-center gap-md">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                            <FileQuestion className="h-4 w-4" />
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <Link href={`/admin/assessments/${assessment.id}`} className="font-body-md text-body-md text-on-surface hover:text-primary">
                              {assessment.title}
                            </Link>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">{ASSESSMENT_KIND_LABEL[assessment.kind]}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-md font-body-md text-body-md text-on-surface-variant">{assessment.programName}</td>
                      <td className="p-md font-body-md text-body-md text-on-surface-variant">
                        <span className="whitespace-nowrap">Module {String(assessment.moduleOrder).padStart(2, "0")}</span>
                        <span className="block font-label-sm text-label-sm">{assessment.moduleTitle}</span>
                      </td>
                      <td className="p-md text-right font-body-md text-body-md text-on-surface">{assessment.questionCount}</td>
                      <td className="p-md text-right font-body-md text-body-md text-on-surface">{assessment.attemptCount}</td>
                      <td className="p-md">
                        <StatusPill tone={CONTENT_STATUS[assessment.status].tone} dot={false}>
                          {CONTENT_STATUS[assessment.status].label}
                        </StatusPill>
                      </td>
                      <td className="whitespace-nowrap p-md font-body-md text-body-md text-on-surface-variant">
                        {formatRelativeTime(assessment.updatedAt)}
                      </td>
                      <td className="p-md text-right">
                        <Link
                          href={`/admin/assessments/${assessment.id}`}
                          aria-label={`Open ${assessment.title}`}
                          className="font-label-md text-label-md text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...page} noun="assessments" hrefFor={(next) => href({ page: next })} />
          </>
        )}
      </Panel>
    </div>
  );
}
