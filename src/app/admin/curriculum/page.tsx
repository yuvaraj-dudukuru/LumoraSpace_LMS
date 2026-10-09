import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  FileQuestion,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LessonType } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import {
  formatMinutes,
  getCurriculumForAdmin,
  type CurriculumLesson,
  type CurriculumModule,
} from "@/lib/queries/admin-curriculum";
import { formatRelativeTime } from "@/lib/format";
import { ActionButton } from "@/components/admin/action-button";
import { ModalForm } from "@/components/admin/modal-form";
import { FieldRow, SelectField, TextAreaField, TextField } from "@/components/admin/fields";
import { ASSESSMENT_KIND_LABEL, CONTENT_STATUS, LESSON_TYPE_LABEL } from "@/components/admin/status";
import { EmptyState, FilterSelect, PageHeader, Panel, StatusPill } from "@/components/admin/ui";
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  moveLesson,
  moveModule,
  setModuleStatus,
  updateLesson,
  updateModule,
} from "./actions";

const LESSON_ICON: Record<LessonType, LucideIcon> = { VIDEO: Video, READING: FileText, QUIZ: FileQuestion };

function ModuleFields({ programModule }: { programModule?: CurriculumModule }) {
  return (
    <>
      <TextField name="title" label="Module title" required maxLength={120} defaultValue={programModule?.title} />
      <TextAreaField name="description" label="Description" rows={3} maxLength={500} defaultValue={programModule?.description ?? undefined} />
      <TextField
        name="estimatedDurationMins"
        label="Estimated duration (minutes)"
        type="number"
        min={1}
        max={6000}
        hint="Optional. The builder also adds up the lessons' own durations."
        defaultValue={programModule?.estimatedDurationMins ?? undefined}
      />
    </>
  );
}

function LessonFields({ programModule, lesson }: { programModule: CurriculumModule; lesson?: CurriculumLesson }) {
  // An assessment can back one quiz lesson only: offer the unlinked ones, plus this lesson's own.
  const assessmentOptions = programModule.assessments
    .filter((assessment) => assessment.lessonId === null || assessment.lessonId === lesson?.id)
    .map((assessment) => ({
      value: assessment.id,
      label: `${assessment.title} (${ASSESSMENT_KIND_LABEL[assessment.kind]}, ${CONTENT_STATUS[assessment.status].label})`,
    }));
  return (
    <>
      <TextField name="title" label="Lesson title" required maxLength={160} defaultValue={lesson?.title} />
      <FieldRow>
        <SelectField
          name="type"
          label="Type"
          required
          defaultValue={lesson?.type ?? "VIDEO"}
          options={[
            { value: "VIDEO", label: "Video" },
            { value: "READING", label: "Reading" },
            { value: "QUIZ", label: "Quiz" },
          ]}
        />
        <TextField name="durationMins" label="Duration (minutes)" type="number" min={1} max={600} defaultValue={lesson?.durationMins ?? undefined} />
      </FieldRow>
      <TextAreaField name="description" label="Summary" rows={2} maxLength={500} defaultValue={lesson?.description ?? undefined} />
      <TextField
        name="videoUrl"
        label="Video URL"
        type="url"
        placeholder="https://www.youtube.com/embed/…"
        hint="For video lessons: an unlisted YouTube or Vimeo embed URL."
        defaultValue={lesson?.videoUrl ?? undefined}
      />
      <TextAreaField
        name="bodyContent"
        label="Reading content"
        rows={5}
        maxLength={20000}
        hint="For reading lessons. Markdown is supported."
        defaultValue={lesson?.bodyContent ?? undefined}
      />
      <SelectField
        name="assessmentId"
        label="Linked assessment"
        placeholder="— None —"
        hint={
          assessmentOptions.length === 0
            ? "For quiz lessons. This module has no unlinked assessment — create one on the Assessments page first."
            : "For quiz lessons: the assessment a learner takes to complete it."
        }
        defaultValue={lesson?.assessment?.id}
        options={assessmentOptions}
      />
    </>
  );
}

export default async function AdminCurriculumPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  await requireRole("ADMIN");
  const requested = (await searchParams).program;

  const programs = await prisma.program.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, status: true },
  });

  if (programs.length === 0) {
    return (
      <div className="flex flex-col gap-xl">
        <PageHeader title="Curriculum" description="Design, organize, and manage the learning path for your programs." />
        <EmptyState icon={<BookOpen className="h-10 w-10 text-on-surface-variant" />}>
          There are no programs yet.{" "}
          <Link href="/admin/programs" className="text-primary hover:underline">
            Create a program
          </Link>{" "}
          first, then build its curriculum here.
        </EmptyState>
      </div>
    );
  }

  // Default to the first PUBLISHED program, else simply the first.
  const fallback = programs.find((program) => program.status === "PUBLISHED") ?? programs[0];
  const selectedId = programs.some((program) => program.id === requested) ? (requested as string) : fallback.id;
  const curriculum = await getCurriculumForAdmin(selectedId);
  if (!curriculum) return null; // unreachable: selectedId came from the list above

  const { program, modules, counts, issues } = curriculum;
  const readOnly = program.status === "ARCHIVED";

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader title="Curriculum" description="Design, organize, and manage the learning path for your programs.">
        <div className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-md">
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Current Program</span>
          <div className="flex flex-wrap items-center gap-md">
            <FilterSelect
              action="/admin/curriculum"
              name="program"
              label="Program"
              value={program.id}
              options={programs.map((option) => ({
                value: option.id,
                label: `${option.name}${option.status === "PUBLISHED" ? "" : ` (${CONTENT_STATUS[option.status].label.toLowerCase()})`}`,
              }))}
            />
            <StatusPill tone={CONTENT_STATUS[program.status].tone}>{CONTENT_STATUS[program.status].label}</StatusPill>
          </div>
        </div>
      </PageHeader>

      <dl className="grid grid-cols-2 gap-md rounded-2xl bg-surface-container-lowest p-md sm:grid-cols-3 lg:grid-cols-5">
        <CountTile label="Modules" value={counts.modules} />
        <CountTile label="Lessons" value={counts.lessons} />
        <CountTile label="Practice Items" value={counts.practiceItems} />
        <CountTile label="Assignments" value={counts.assignments} />
        <CountTile label="Assessments" value={counts.assessments} />
      </dl>

      {readOnly ? (
        <p role="status" className="rounded-lg bg-surface-container px-md py-sm font-label-md text-label-md text-on-surface-variant">
          This program is archived, so its curriculum is read-only. Restore the program to edit it.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          {modules.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-10 w-10 text-on-surface-variant" />}>
              No modules yet. Add the first one with “Add Module”.
            </EmptyState>
          ) : (
            modules.map((programModule, moduleIndex) => (
              <details
                key={programModule.id}
                open={moduleIndex === 0}
                className="group rounded-2xl border border-outline-variant/40 bg-surface-container-lowest"
              >
                <summary className="flex cursor-pointer list-none items-center gap-md p-lg [&::-webkit-details-marker]:hidden">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high font-label-md text-label-md text-on-surface group-open:bg-primary-container group-open:text-on-primary">
                    {String(programModule.order).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-headline-md text-headline-md text-on-surface">{programModule.title}</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      {programModule.lessons.length} lesson{programModule.lessons.length === 1 ? "" : "s"} • Est.{" "}
                      {formatMinutes(programModule.estimatedDurationMins ?? programModule.lessonMinutes)}
                    </span>
                  </span>
                  <StatusPill tone={CONTENT_STATUS[programModule.status].tone}>{CONTENT_STATUS[programModule.status].label}</StatusPill>
                  <ChevronDown className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>

                <div className="flex flex-col gap-md border-t border-outline-variant/40 p-lg">
                  {programModule.description ? (
                    <p className="font-body-md text-body-md text-on-surface-variant">{programModule.description}</p>
                  ) : null}

                  {readOnly ? null : (
                    <div className="flex flex-wrap items-center gap-sm">
                      <ModalForm
                        trigger={
                          <>
                            <Pencil className="h-4 w-4" /> Edit Module
                          </>
                        }
                        triggerVariant="outline"
                        title="Edit Module"
                        submitLabel="Save Changes"
                        action={updateModule.bind(null, programModule.id)}
                      >
                        <ModuleFields programModule={programModule} />
                      </ModalForm>
                      {programModule.status === "PUBLISHED" ? (
                        <ActionButton
                          action={setModuleStatus.bind(null, programModule.id, "DRAFT")}
                          pendingLabel="Unpublishing..."
                          confirm="Unpublish this module? Learners stop seeing it and their progress percentages are recalculated."
                          confirmLabel="Unpublish"
                        >
                          Unpublish
                        </ActionButton>
                      ) : (
                        <ActionButton action={setModuleStatus.bind(null, programModule.id, "PUBLISHED")} variant="primary" pendingLabel="Publishing...">
                          Publish
                        </ActionButton>
                      )}
                      <ActionButton
                        action={moveModule.bind(null, programModule.id, "up")}
                        variant="icon"
                        label={`Move ${programModule.title} up`}
                        disabled={moduleIndex === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </ActionButton>
                      <ActionButton
                        action={moveModule.bind(null, programModule.id, "down")}
                        variant="icon"
                        label={`Move ${programModule.title} down`}
                        disabled={moduleIndex === modules.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </ActionButton>
                      <ActionButton
                        action={deleteModule.bind(null, programModule.id)}
                        variant="dangerLink"
                        confirm={`Delete “${programModule.title}” and everything in it?`}
                        confirmLabel="Delete"
                        pendingLabel="Deleting..."
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </ActionButton>
                    </div>
                  )}

                  {programModule.lessons.length === 0 ? (
                    <p className="rounded-xl bg-surface-container-low p-md font-body-md text-body-md text-on-surface-variant">
                      No lessons yet.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-sm">
                      {programModule.lessons.map((lesson, lessonIndex) => {
                        const Icon = LESSON_ICON[lesson.type];
                        return (
                          <li
                            key={lesson.id}
                            className={`flex flex-wrap items-center gap-md rounded-xl bg-surface-container-low p-md ${lesson.type === "QUIZ" ? "border-l-4 border-secondary" : ""}`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-xs">
                              <span className="font-body-md text-body-md text-on-surface">{lesson.title}</span>
                              <span className="flex flex-wrap items-center gap-sm font-label-md text-label-md text-on-surface-variant">
                                <span className="rounded bg-surface-container-high px-sm py-xs font-label-sm text-label-sm uppercase tracking-wider">
                                  Lesson {String(lessonIndex + 1).padStart(2, "0")}
                                </span>
                                {LESSON_TYPE_LABEL[lesson.type]}
                                {lesson.durationMins !== null ? ` • ${formatMinutes(lesson.durationMins)}` : ""}
                                {lesson.type === "QUIZ"
                                  ? lesson.assessment
                                    ? ` • ${lesson.assessment.title} (${lesson.assessment.questionCount} question${lesson.assessment.questionCount === 1 ? "" : "s"})`
                                    : " • no assessment linked"
                                  : ""}
                              </span>
                            </div>
                            {readOnly ? null : (
                              <div className="flex shrink-0 items-center gap-xs">
                                <ActionButton
                                  action={moveLesson.bind(null, lesson.id, "up")}
                                  variant="icon"
                                  label={`Move ${lesson.title} up`}
                                  disabled={lessonIndex === 0}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </ActionButton>
                                <ActionButton
                                  action={moveLesson.bind(null, lesson.id, "down")}
                                  variant="icon"
                                  label={`Move ${lesson.title} down`}
                                  disabled={lessonIndex === programModule.lessons.length - 1}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </ActionButton>
                                <ModalForm
                                  trigger={<Pencil className="h-4 w-4" />}
                                  triggerVariant="icon"
                                  triggerLabel={`Edit ${lesson.title}`}
                                  title="Edit Lesson"
                                  submitLabel="Save Changes"
                                  action={updateLesson.bind(null, lesson.id)}
                                >
                                  <LessonFields programModule={programModule} lesson={lesson} />
                                </ModalForm>
                                <ActionButton
                                  action={deleteLesson.bind(null, lesson.id)}
                                  variant="icon"
                                  label={`Delete ${lesson.title}`}
                                  confirm="Delete this lesson?"
                                  confirmLabel="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </ActionButton>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {readOnly ? null : (
                    <ModalForm
                      trigger={
                        <>
                          <Plus className="h-4 w-4" /> Add Lesson to {programModule.title}
                        </>
                      }
                      triggerVariant="outline"
                      title="Add Lesson"
                      description={`Added at the end of ${programModule.title}.`}
                      submitLabel="Add Lesson"
                      pendingLabel="Adding..."
                      action={createLesson.bind(null, programModule.id)}
                    >
                      <LessonFields programModule={programModule} />
                    </ModalForm>
                  )}

                  {programModule.assessments.length > 0 || programModule.assignments.length > 0 ? (
                    <div className="flex flex-col gap-sm border-t border-outline-variant/40 pt-md">
                      <h3 className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
                        Assessments &amp; assignments in this module
                      </h3>
                      <ul className="flex flex-col gap-xs">
                        {programModule.assessments.map((assessment) => (
                          <li key={assessment.id} className="flex flex-wrap items-center gap-sm font-label-md text-label-md">
                            <FileQuestion className="h-4 w-4 text-on-surface-variant" />
                            <Link href={`/admin/assessments/${assessment.id}`} className="text-primary hover:underline">
                              {assessment.title}
                            </Link>
                            <span className="text-on-surface-variant">
                              {ASSESSMENT_KIND_LABEL[assessment.kind]} • {assessment.questionCount} question
                              {assessment.questionCount === 1 ? "" : "s"} • {CONTENT_STATUS[assessment.status].label}
                            </span>
                          </li>
                        ))}
                        {programModule.assignments.map((assignment) => (
                          <li key={assignment.id} className="flex flex-wrap items-center gap-sm font-label-md text-label-md">
                            <ClipboardList className="h-4 w-4 text-on-surface-variant" />
                            <span className="text-on-surface">{assignment.title}</span>
                            <span className="text-on-surface-variant">
                              {assignment.type === "PROJECT" ? "Project" : "Assignment"} • {assignment.submissionCount} submission
                              {assignment.submissionCount === 1 ? "" : "s"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ))
          )}
        </div>

        <div className="flex flex-col gap-lg">
          <Panel className="flex flex-col gap-md p-lg">
            <h2 className="font-headline-md text-headline-md text-on-surface">Actions</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Changes save immediately. A new module stays a draft, hidden from learners, until you publish it.
            </p>
            {readOnly ? null : (
              <ModalForm
                trigger={
                  <>
                    <Plus className="h-4 w-4" /> Add Module
                  </>
                }
                title="Add Module"
                description={`Added at the end of ${program.name}, as a draft.`}
                submitLabel="Add Module"
                pendingLabel="Adding..."
                action={createModule.bind(null, program.id)}
              >
                <ModuleFields />
              </ModalForm>
            )}
            <Link
              href="/admin/assessments"
              className="flex items-center justify-center gap-sm rounded-lg border border-outline bg-surface-container-lowest px-lg py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              <FileQuestion className="h-4 w-4" /> Manage Assessments
            </Link>
          </Panel>

          <Panel className="flex flex-col gap-md p-lg">
            <h2 className="flex items-center gap-sm font-headline-md text-headline-md text-on-surface">
              <ListChecks className="h-6 w-6 text-primary" /> Curriculum Validation
            </h2>
            {issues.length === 0 ? (
              <>
                <p className="flex items-center gap-sm rounded-lg bg-surface-container-low p-md font-body-md text-body-md text-on-surface">
                  <CircleCheck className="h-5 w-5 text-success" /> No issues detected
                </p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Checked: every module has lessons, every quiz has a published assessment with questions, every video has a
                  URL and every reading has content.
                </p>
              </>
            ) : (
              <ul className="flex flex-col gap-sm">
                {issues.map((issue) => (
                  <li key={issue.id} className="flex items-start gap-sm rounded-lg bg-warning-container p-md font-label-md text-label-md text-on-surface">
                    <TriangleAlert className="mt-xs h-4 w-4 shrink-0 text-warning" />
                    {issue.items.length === 0 ? (
                      issue.message
                    ) : (
                      <details className="min-w-0 flex-1">
                        <summary className="cursor-pointer">{issue.message}</summary>
                        <ul className="mt-sm flex flex-col gap-xs font-label-sm text-label-sm text-on-surface-variant">
                          {issue.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="flex flex-col gap-md p-lg">
            <h2 className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">Quick Stats</h2>
            <dl className="flex flex-col gap-sm">
              <QuickStat label="Total Duration" value={formatMinutes(curriculum.totalMinutes)} />
              <QuickStat
                label="Avg. Module Time"
                value={modules.length === 0 ? "—" : formatMinutes(Math.round(curriculum.totalMinutes / modules.length))}
              />
              <QuickStat label="Last Updated" value={formatRelativeTime(program.updatedAt)} />
            </dl>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Durations add up the lessons that have one set.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-xs rounded-xl bg-surface-container-low p-md">
      <dt className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="font-headline-md text-headline-md text-on-surface">{value}</dd>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-md">
      <dt className="font-body-md text-body-md text-on-surface-variant">{label}</dt>
      <dd className="font-label-md text-label-md text-on-surface">{value}</dd>
    </div>
  );
}
