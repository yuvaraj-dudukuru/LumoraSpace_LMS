import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Dumbbell,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { ModalForm } from "@/components/admin/modal-form";
import { TextAreaField, TextField } from "@/components/admin/fields";
import { ProgramFields } from "../program-fields";
import { addProgramOutcome, deleteProgramOutcome, updateProgram } from "../actions";
import type { BatchStatus, ProgramLevel } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { getProgramDetailForAdmin } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { ProgramStatusPill } from "../program-status";
import { ProgramStatusControls } from "./program-status-controls";

const LEVEL_LABEL: Record<ProgramLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  UPCOMING: "Upcoming",
  ACTIVE: "In Progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const BATCH_STATUS_STYLE: Record<BatchStatus, string> = {
  UPCOMING: "bg-secondary-fixed text-secondary",
  ACTIVE: "bg-primary-fixed text-primary",
  COMPLETED: "bg-success-container text-success",
  ARCHIVED: "bg-surface-container-high text-on-surface-variant",
};

function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export default async function AdminProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const program = await getProgramDetailForAdmin(id);
  if (!program) notFound();

  const { curriculum } = program;

  return (
    <div className="flex flex-col gap-xl">
      <nav aria-label="Breadcrumb" className="flex items-center gap-xs font-label-md text-label-md">
        <Link href="/admin/programs" className="text-on-surface-variant hover:text-on-surface">
          Programs
        </Link>
        <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
        <span className="text-on-surface">{program.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-lg">
        <div className="flex max-w-2xl flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-md">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{program.name}</h1>
            <ProgramStatusPill status={program.status} />
          </div>
          <div className="flex flex-wrap gap-sm">
            <Chip icon={<TrendingUp className="h-3.5 w-3.5" />} label={LEVEL_LABEL[program.level]} />
            <Chip icon={<Clock className="h-3.5 w-3.5" />} label={`${program.durationWeeks} Weeks`} />
            {program.credentialType ? (
              <Chip icon={<Award className="h-3.5 w-3.5" />} label={program.credentialType} />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-sm">
          <ProgramStatusControls programId={program.id} status={program.status} openBatchCount={program.openBatchCount} />
          <ModalForm
            trigger={
              <>
                <Pencil className="h-4 w-4" /> Edit Program
              </>
            }
            title="Edit Program"
            submitLabel="Save Changes"
            action={updateProgram.bind(null, program.id)}
          >
            <ProgramFields program={program} />
          </ModalForm>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Batches" value={program.activeBatchCodes.length} unit="running now">
          {program.activeBatchCodes.length > 0 ? (
            <div className="flex flex-wrap gap-xs">
              {program.activeBatchCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-full bg-surface-container-high px-sm py-xs font-label-sm text-label-sm text-on-surface-variant"
                >
                  {code}
                </span>
              ))}
            </div>
          ) : null}
        </StatCard>
        <StatCard label="Enrolled Learners" value={program.enrollmentCount} unit="total">
          <ProgressBar percent={percentOf(program.activeEnrollmentCount, program.enrollmentCount)} label="Active share of enrollments" />
        </StatCard>
        <StatCard
          label="Assigned Mentors"
          value={program.mentorCount}
          unit={program.mentorCount === 1 ? "mentor" : "mentors"}
        >
          <span className="font-label-sm text-label-sm text-on-surface-variant">Across this program&apos;s batches</span>
        </StatCard>
        <StatCard label="Assessments" value={curriculum.gradedAssessmentCount} unit="graded">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Count toward the certificate</span>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl lg:col-span-2">
          <section className="flex flex-col gap-md rounded-2xl bg-surface-container-lowest p-xl">
            <h2 className="font-headline-md text-headline-md text-on-surface">Program Overview</h2>
            <p className="whitespace-pre-line font-body-md text-body-md text-on-surface-variant">{program.description}</p>
          </section>

          <section className="flex flex-col gap-lg rounded-2xl bg-surface-container-lowest p-xl">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">Curriculum Structure</h2>
              <div className="flex flex-wrap items-center gap-lg">
                {program.status === "PUBLISHED" ? (
                  <Link
                    href={`/programs/${program.slug}`}
                    className="flex items-center gap-xs font-label-md text-label-md text-primary hover:underline"
                  >
                    View public page <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
                <Link
                  href={`/admin/curriculum?program=${program.id}`}
                  className="flex items-center gap-xs font-label-md text-label-md text-primary hover:underline"
                >
                  Edit curriculum <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-md md:grid-cols-4">
              <CurriculumTile icon={<LayoutGrid className="h-5 w-5" />} value={curriculum.moduleCount} label="Modules" />
              <CurriculumTile icon={<BookOpen className="h-5 w-5" />} value={curriculum.lessonCount} label="Lessons" />
              <CurriculumTile
                icon={<Dumbbell className="h-5 w-5" />}
                value={curriculum.practiceActivityCount}
                label="Practice Activities"
              />
              <CurriculumTile
                icon={<ClipboardCheck className="h-5 w-5" />}
                value={curriculum.gradedAssessmentCount}
                label="Assessments"
              />
            </div>
            {program.modules.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">This program has no modules yet.</p>
            ) : (
              <ol className="flex flex-col">
                {program.modules.map((programModule, index) => (
                  <li key={programModule.id} className="flex gap-md">
                    <div className="flex flex-col items-center">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface">
                        {programModule.order}
                      </span>
                      {index < program.modules.length - 1 ? (
                        <span className="w-px flex-1 bg-outline-variant/60" aria-hidden="true" />
                      ) : null}
                    </div>
                    <div className={`flex flex-col ${index < program.modules.length - 1 ? "pb-lg" : ""}`}>
                      <span className="font-label-md text-label-md text-on-surface">{programModule.title}</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {programModule.lessonCount} Lesson{programModule.lessonCount === 1 ? "" : "s"}
                        {programModule.status !== "PUBLISHED" ? ` • ${programModule.status === "DRAFT" ? "Draft" : "Archived"}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="flex flex-col gap-lg rounded-2xl bg-surface-container-lowest p-xl">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">What Learners Will Learn</h2>
                <p className="font-label-md text-label-md text-on-surface-variant">Shown as tiles on the public program page.</p>
              </div>
              <ModalForm
                trigger={
                  <>
                    <Plus className="h-4 w-4" /> Add Outcome
                  </>
                }
                triggerVariant="link"
                title="Add Outcome"
                submitLabel="Add Outcome"
                action={addProgramOutcome.bind(null, program.id)}
              >
                <TextField name="title" label="Title" required maxLength={80} placeholder="SQL Fundamentals" />
                <TextAreaField name="description" label="Description" required rows={3} maxLength={300} />
              </ModalForm>
            </div>
            {program.outcomes.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                No outcomes yet — the public page hides this section until one is added.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-md sm:grid-cols-2">
                {program.outcomes.map((outcome) => (
                  <li key={outcome.id} className="flex items-start gap-sm rounded-xl bg-surface-container-low p-md">
                    <div className="flex min-w-0 flex-1 flex-col gap-xs">
                      <span className="font-label-md text-label-md text-on-surface">{outcome.title}</span>
                      <span className="font-body-md text-body-md text-on-surface-variant">{outcome.description}</span>
                    </div>
                    <ActionButton
                      action={deleteProgramOutcome.bind(null, program.id, outcome.id)}
                      variant="icon"
                      label={`Delete outcome ${outcome.title}`}
                      confirm="Delete this outcome?"
                      confirmLabel="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-xl">
          <section className="flex flex-col gap-lg rounded-2xl bg-surface-container-lowest p-lg">
            <h2 className="font-title-lg text-title-lg text-on-surface">Enrollment Summary</h2>
            <SummaryRow
              label="Active"
              count={program.activeEnrollmentCount}
              percent={percentOf(program.activeEnrollmentCount, program.enrollmentCount)}
              dot="bg-secondary"
              bar="bg-secondary"
            />
            <SummaryRow
              label="Completed"
              count={program.completedEnrollmentCount}
              percent={percentOf(program.completedEnrollmentCount, program.enrollmentCount)}
              dot="bg-outline-variant"
              bar="bg-outline-variant"
            />
          </section>

          <section className="flex flex-col gap-md rounded-2xl bg-surface-container-lowest p-lg">
            <h2 className="font-title-lg text-title-lg text-on-surface">Recent Batches</h2>
            {program.recentBatches.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No batches have been created yet.</p>
            ) : (
              <ul className="flex flex-col gap-md">
                {program.recentBatches.map((batch) => (
                  <li key={batch.id} className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-md">
                    <div className="flex items-center justify-between gap-md">
                      <span className="font-label-md text-label-md text-on-surface">
                        {batch.name} <span className="text-on-surface-variant">· {batch.code}</span>
                      </span>
                      <span
                        className={`whitespace-nowrap rounded px-sm py-xs font-label-sm text-label-sm ${BATCH_STATUS_STYLE[batch.status]}`}
                      >
                        {BATCH_STATUS_LABEL[batch.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-md font-label-md text-label-md text-on-surface-variant">
                      <span className="flex items-center gap-xs">
                        <Users className="h-4 w-4" />
                        {batch.capacity !== null
                          ? `${batch.learnerCount} / ${batch.capacity} enrolled`
                          : `${batch.learnerCount} learner${batch.learnerCount === 1 ? "" : "s"}`}
                      </span>
                      <span className="flex items-center gap-xs">
                        <CalendarDays className="h-4 w-4" />
                        {batch.startDate.getTime() > Date.now() ? "Starts" : "Started"} {formatDate(batch.startDate)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-xs rounded-md bg-surface-container px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
      {icon} {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: number;
  unit: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-sm rounded-2xl bg-surface-container-lowest p-lg">
      <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">{label}</span>
      <p className="flex items-baseline gap-sm">
        <span className="font-headline-lg text-headline-lg text-on-surface">{value}</span>
        <span className="font-label-md text-label-md text-on-surface-variant">{unit}</span>
      </p>
      {children}
    </div>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest"
    >
      <div className="h-full rounded-full bg-secondary" style={{ width: `${percent}%` }} />
    </div>
  );
}

function CurriculumTile({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-md">
      <span className="text-primary">{icon}</span>
      <span className="font-headline-md text-headline-md text-on-surface">{value}</span>
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
    </div>
  );
}

function SummaryRow({
  label,
  count,
  percent,
  dot,
  bar,
}: {
  label: string;
  count: number;
  percent: number;
  dot: string;
  bar: string;
}) {
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-md">
        <span className="flex items-center gap-sm font-body-md text-body-md text-on-surface">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" /> {label}
        </span>
        <span className="font-title-lg text-title-lg text-on-surface">{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
