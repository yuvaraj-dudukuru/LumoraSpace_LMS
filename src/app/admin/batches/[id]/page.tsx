import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronRight, Clock, GraduationCap, Pencil, Plus, X } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getBatchDetailForAdmin } from "@/lib/queries/admin-batches";
import { getMentorOptions } from "@/lib/queries/admin-options";
import { ActionButton } from "@/components/admin/action-button";
import { ModalForm } from "@/components/admin/modal-form";
import { SelectField, TextField } from "@/components/admin/fields";
import { ACCESS_STATE, BATCH_STATUS, ENROLLMENT_STATUS, formatDateRange } from "@/components/admin/status";
import { Avatar, Panel, ProgressBar, StatusPill } from "@/components/admin/ui";
import { BatchFields } from "../batch-fields";
import { addBatchMentor, removeBatchMentor, setBatchStatus, updateBatch } from "../actions";

const LEARNER_PREVIEW_LIMIT = 8;

export default async function AdminBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const [batch, mentorOptions] = await Promise.all([getBatchDetailForAdmin(id), getMentorOptions()]);
  if (!batch) notFound();

  const assignedMentorIds = new Set(batch.mentors.map((mentor) => mentor.mentorId));
  const assignableMentors = mentorOptions.filter((option) => !assignedMentorIds.has(option.value));
  const enrollmentsHref = `/admin/enrollments?search=${encodeURIComponent(batch.code)}`;

  return (
    <div className="flex flex-col gap-xl">
      <nav aria-label="Breadcrumb" className="flex items-center gap-xs font-label-md text-label-md">
        <Link href="/admin/batches" className="text-on-surface-variant hover:text-on-surface">
          Batches
        </Link>
        <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
        <span className="text-on-surface">{batch.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-lg">
        <div className="flex flex-col gap-sm">
          <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface lg:font-display-lg lg:text-display-lg">
            {batch.name}
          </h1>
          <p className="flex flex-wrap items-center gap-md font-body-lg text-body-lg text-on-surface-variant">
            <Link href={`/admin/programs/${batch.program.id}`} className="flex items-center gap-xs hover:text-primary">
              <GraduationCap className="h-5 w-5" /> {batch.program.name}
            </Link>
            <span className="flex items-center gap-xs">
              <CalendarDays className="h-5 w-5" /> {formatDateRange(batch.startDate, batch.endDate)}
            </span>
            <StatusPill tone={BATCH_STATUS[batch.status].tone} dot={false}>
              {BATCH_STATUS[batch.status].label}
            </StatusPill>
          </p>
          <p className="flex flex-wrap items-center gap-md font-label-md text-label-md text-on-surface-variant">
            <span>Code {batch.code}</span>
            {batch.scheduleNote ? (
              <span className="flex items-center gap-xs">
                <Clock className="h-4 w-4" /> {batch.scheduleNote}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-sm">
          <ModalForm
            trigger={
              <>
                <Pencil className="h-4 w-4" /> Edit Batch
              </>
            }
            triggerVariant="outline"
            title="Edit Batch"
            submitLabel="Save Changes"
            action={updateBatch.bind(null, batch.id)}
          >
            <BatchFields
              programOptions={[]}
              batch={{
                programId: batch.program.id,
                programName: batch.program.name,
                name: batch.name,
                code: batch.code,
                startDate: batch.startDate,
                endDate: batch.endDate,
                scheduleNote: batch.scheduleNote,
                capacity: batch.capacity,
              }}
            />
          </ModalForm>
          {batch.status === "UPCOMING" ? (
            <ActionButton action={setBatchStatus.bind(null, batch.id, "ACTIVE")} variant="primary" pendingLabel="Starting...">
              Start Batch
            </ActionButton>
          ) : null}
          {batch.status === "ACTIVE" ? (
            <ActionButton
              action={setBatchStatus.bind(null, batch.id, "COMPLETED")}
              variant="primary"
              pendingLabel="Completing..."
              confirm="Mark this batch as completed?"
            >
              Complete Batch
            </ActionButton>
          ) : null}
          {batch.status === "COMPLETED" ? (
            <ActionButton action={setBatchStatus.bind(null, batch.id, "ACTIVE")} pendingLabel="Reopening...">
              Reopen Batch
            </ActionButton>
          ) : null}
          {batch.status === "ARCHIVED" ? (
            <ActionButton action={setBatchStatus.bind(null, batch.id, "UPCOMING")} pendingLabel="Restoring...">
              Restore as Upcoming
            </ActionButton>
          ) : (
            <ActionButton
              action={setBatchStatus.bind(null, batch.id, "ARCHIVED")}
              variant="danger"
              pendingLabel="Archiving..."
              confirm="Archive this batch? It stops accepting enrollments; learners keep their access."
            >
              Archive
            </ActionButton>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl">
          <Panel className="flex flex-col gap-lg p-lg">
            <h2 className="font-headline-md text-headline-md text-on-surface">Batch Statistics</h2>
            <dl className="grid grid-cols-2 gap-md">
              <div className="flex flex-col gap-xs rounded-xl bg-surface-container-low p-md">
                <dt className="font-label-md text-label-md text-on-surface-variant">Learners</dt>
                <dd className="font-headline-lg text-headline-lg text-on-surface">{batch.learnerCount}</dd>
              </div>
              <div className="flex flex-col gap-xs rounded-xl bg-surface-container-low p-md">
                <dt className="font-label-md text-label-md text-on-surface-variant">Mentors</dt>
                <dd className="font-headline-lg text-headline-lg text-on-surface">{batch.mentors.length}</dd>
              </div>
              <div className="col-span-2 flex flex-col gap-sm rounded-xl bg-surface-container-low p-md">
                <dt className="font-label-md text-label-md text-on-surface-variant">Seats Filled</dt>
                <dd className="flex items-baseline gap-sm">
                  <span className="font-headline-lg text-headline-lg text-on-surface">{batch.learnerCount}</span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {batch.capacity !== null ? `/ ${batch.capacity}` : "no limit set"}
                  </span>
                </dd>
                {batch.capacity !== null ? (
                  <ProgressBar percent={(batch.learnerCount / batch.capacity) * 100} label="Seats filled" />
                ) : null}
              </div>
            </dl>
          </Panel>

          <Panel className="flex flex-col gap-md p-lg">
            <h2 className="flex items-center justify-between font-headline-md text-headline-md text-on-surface">
              Program Info <GraduationCap className="h-6 w-6 text-primary" aria-hidden="true" />
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">{batch.program.description}</p>
            <p className="font-label-md text-label-md text-on-surface-variant">
              {batch.program.durationWeeks} week{batch.program.durationWeeks === 1 ? "" : "s"}
            </p>
            <Link
              href={`/admin/programs/${batch.program.id}`}
              className="flex items-center gap-sm font-label-md text-label-md text-primary hover:underline"
            >
              View Program Details <ArrowRight className="h-4 w-4" />
            </Link>
          </Panel>
        </div>

        <div className="flex flex-col gap-xl lg:col-span-2">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-md border-b border-outline-variant/40 p-lg">
              <h2 className="font-headline-md text-headline-md text-on-surface">Learners Overview</h2>
              <Link href={enrollmentsHref} className="font-label-md text-label-md text-primary hover:underline">
                View All Learners
              </Link>
            </div>
            {batch.learners.length === 0 ? (
              <p className="p-lg font-body-md text-body-md text-on-surface-variant">No one is enrolled in this batch yet.</p>
            ) : (
              <ul>
                {batch.learners.slice(0, LEARNER_PREVIEW_LIMIT).map((learner) => (
                  <li
                    key={learner.enrollmentId}
                    className="flex flex-wrap items-center gap-md border-b border-outline-variant/30 p-md last:border-0"
                  >
                    <Avatar name={learner.name} />
                    <Link href={`/admin/users/${learner.userId}`} className="flex min-w-0 flex-1 flex-col hover:text-primary">
                      <span className="truncate font-body-md text-body-md text-on-surface">{learner.name}</span>
                      <span className="truncate font-label-md text-label-md text-on-surface-variant">{learner.email}</span>
                    </Link>
                    <span className="font-label-md text-label-md text-on-surface-variant">{Math.round(learner.progressPercent)}%</span>
                    <StatusPill tone={ACCESS_STATE[learner.accessState].tone}>{ACCESS_STATE[learner.accessState].label}</StatusPill>
                    <StatusPill tone={ENROLLMENT_STATUS[learner.status].tone} dot={false}>
                      {ENROLLMENT_STATUS[learner.status].label}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            )}
            {batch.learners.length > LEARNER_PREVIEW_LIMIT ? (
              <p className="border-t border-outline-variant/40 p-md font-label-md text-label-md text-on-surface-variant">
                Showing {LEARNER_PREVIEW_LIMIT} of {batch.learners.length}.{" "}
                <Link href={enrollmentsHref} className="text-primary hover:underline">
                  See them all in Enrollments
                </Link>
              </p>
            ) : null}
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-md border-b border-outline-variant/40 p-lg">
              <h2 className="font-headline-md text-headline-md text-on-surface">Assigned Mentors</h2>
              {assignableMentors.length > 0 ? (
                <ModalForm
                  trigger={
                    <>
                      <Plus className="h-4 w-4" /> Assign Mentor
                    </>
                  }
                  triggerVariant="link"
                  title="Assign Mentor"
                  description={`Mentors see the learners and submissions of ${batch.name}.`}
                  submitLabel="Assign"
                  pendingLabel="Assigning..."
                  action={addBatchMentor.bind(null, batch.id)}
                >
                  <SelectField name="mentorId" label="Mentor" required placeholder="Select a mentor" options={assignableMentors} />
                  <TextField name="roleLabel" label="Role on this batch" maxLength={80} placeholder="Lead Instructor" />
                </ModalForm>
              ) : null}
            </div>
            {batch.mentors.length === 0 ? (
              <p className="p-lg font-body-md text-body-md text-on-surface-variant">
                No mentor is assigned, so submissions from this batch have no one to review them.
                {assignableMentors.length === 0 ? " Add a mentor account first on the Mentors page." : ""}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-md p-lg sm:grid-cols-2">
                {batch.mentors.map((mentor) => (
                  <li key={mentor.assignmentId} className="flex items-start gap-md rounded-xl bg-surface-container-low p-md">
                    <Avatar name={mentor.name} size="lg" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link href={`/admin/users/${mentor.mentorId}`} className="truncate font-body-md text-body-md text-on-surface hover:text-primary">
                        {mentor.name}
                      </Link>
                      {mentor.roleLabel ? (
                        <span className="font-label-md text-label-md text-primary">{mentor.roleLabel}</span>
                      ) : null}
                      {mentor.title ? (
                        <span className="font-label-md text-label-md text-on-surface-variant">{mentor.title}</span>
                      ) : null}
                    </div>
                    <ActionButton
                      action={removeBatchMentor.bind(null, batch.id, mentor.assignmentId)}
                      variant="icon"
                      label={`Remove ${mentor.name} from this batch`}
                      confirm={`Remove ${mentor.name}?`}
                      confirmLabel="Remove"
                    >
                      <X className="h-4 w-4" />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
