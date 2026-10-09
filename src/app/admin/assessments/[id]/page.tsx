import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, CircleCheck, Copy, Folder, GraduationCap, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { getAssessmentForBuilder, type BuilderQuestion } from "@/lib/queries/admin-assessments";
import { formatDateTime } from "@/lib/format";
import { ActionButton } from "@/components/admin/action-button";
import { ModalForm } from "@/components/admin/modal-form";
import { CheckboxField, FieldRow, SelectField, TextField } from "@/components/admin/fields";
import { ASSESSMENT_KIND_LABEL, CONTENT_STATUS, QUESTION_TYPE_LABEL } from "@/components/admin/status";
import { EmptyState, FilterTabs, Panel, ProgressBar, StatusPill, TH } from "@/components/admin/ui";
import { QuestionFields } from "./question-fields";
import {
  addQuestion,
  deleteAssessment,
  deleteQuestion,
  duplicateAssessment,
  duplicateQuestion,
  moveQuestion,
  setAssessmentStatus,
  updateAssessmentSettings,
  updateQuestion,
} from "../actions";

type Tab = "questions" | "settings" | "results";

const ATTEMPT_STATUS_LABEL = { IN_PROGRESS: "In progress", SUBMITTED: "Submitted", GRADED: "Graded" } as const;

export default async function AssessmentBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;
  const rawTab = (await searchParams).tab;
  const tab: Tab = rawTab === "settings" || rawTab === "results" ? rawTab : "questions";

  const assessment = await getAssessmentForBuilder(id);
  if (!assessment) notFound();

  const locked = assessment.attemptCount > 0;
  const base = `/admin/assessments/${assessment.id}`;
  const passingPoints =
    assessment.passingScorePercent === null ? null : Math.ceil((assessment.totalMarks * assessment.passingScorePercent) / 100);

  return (
    <div className="flex flex-col gap-xl">
      <nav aria-label="Breadcrumb" className="flex items-center gap-xs font-label-md text-label-md">
        <Link href="/admin/assessments" className="text-on-surface-variant hover:text-on-surface">
          Assessments
        </Link>
        <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
        <span className="text-on-surface">{assessment.title}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-lg">
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-md">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{assessment.title}</h1>
            <StatusPill tone={CONTENT_STATUS[assessment.status].tone} dot={false}>
              {CONTENT_STATUS[assessment.status].label}
            </StatusPill>
          </div>
          <p className="font-label-md text-label-md text-on-surface-variant">{ASSESSMENT_KIND_LABEL[assessment.kind]} assessment</p>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <ActionButton action={duplicateAssessment.bind(null, assessment.id)} pendingLabel="Duplicating...">
            <Copy className="h-4 w-4" /> Duplicate
          </ActionButton>
          {assessment.status === "PUBLISHED" ? (
            <ActionButton
              action={setAssessmentStatus.bind(null, assessment.id, "DRAFT")}
              pendingLabel="Unpublishing..."
              confirm="Unpublish? Learners can no longer start it."
              confirmLabel="Unpublish"
            >
              Unpublish
            </ActionButton>
          ) : (
            <ActionButton action={setAssessmentStatus.bind(null, assessment.id, "PUBLISHED")} variant="primary" pendingLabel="Publishing...">
              Publish
            </ActionButton>
          )}
          {assessment.status === "ARCHIVED" ? null : (
            <ActionButton
              action={setAssessmentStatus.bind(null, assessment.id, "ARCHIVED")}
              pendingLabel="Archiving..."
              confirm="Archive this assessment?"
              confirmLabel="Archive"
            >
              Archive
            </ActionButton>
          )}
          {locked ? null : (
            <ActionButton
              action={deleteAssessment.bind(null, assessment.id)}
              variant="danger"
              pendingLabel="Deleting..."
              confirm="Delete this assessment and its questions?"
              confirmLabel="Delete"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </ActionButton>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          <FilterTabs
            label="Assessment sections"
            variant="segment"
            tabs={[
              { label: `Questions (${assessment.questions.length})`, href: base, active: tab === "questions" },
              { label: "Settings", href: `${base}?tab=settings`, active: tab === "settings" },
              { label: `Results (${assessment.attemptCount})`, href: `${base}?tab=results`, active: tab === "results" },
            ]}
          />

          {tab === "questions" ? (
            <section className="flex flex-col gap-md">
              <div className="flex flex-wrap items-center justify-between gap-md">
                <h2 className="font-headline-md text-headline-md text-on-surface">Question Bank</h2>
                {locked ? null : (
                  <ModalForm
                    trigger={
                      <>
                        <Plus className="h-4 w-4" /> Add Question
                      </>
                    }
                    triggerVariant="link"
                    title="Add Question"
                    submitLabel="Add Question"
                    pendingLabel="Adding..."
                    action={addQuestion.bind(null, assessment.id)}
                  >
                    <QuestionFields />
                  </ModalForm>
                )}
              </div>

              {locked ? (
                <p role="status" className="flex items-start gap-sm rounded-lg bg-surface-container px-md py-sm font-label-md text-label-md text-on-surface-variant">
                  <Lock className="mt-xs h-4 w-4 shrink-0" />
                  Learners have attempted this assessment, so its questions are locked — changing them would change what
                  those attempts were graded on. Use Duplicate to make an editable copy.
                </p>
              ) : null}

              {assessment.questions.length === 0 ? (
                <EmptyState>No questions yet. Add the first one — an assessment needs at least one to be published.</EmptyState>
              ) : (
                <ol className="flex flex-col gap-md">
                  {assessment.questions.map((question, index) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      number={index + 1}
                      isFirst={index === 0}
                      isLast={index === assessment.questions.length - 1}
                      locked={locked}
                    />
                  ))}
                </ol>
              )}
            </section>
          ) : null}

          {tab === "settings" ? (
            <Panel className="flex flex-col gap-lg p-lg">
              <div className="flex flex-wrap items-center justify-between gap-md">
                <h2 className="font-headline-md text-headline-md text-on-surface">Settings</h2>
                <ModalForm
                  trigger={
                    <>
                      <Pencil className="h-4 w-4" /> Edit Settings
                    </>
                  }
                  triggerVariant="outline"
                  title="Assessment Settings"
                  submitLabel="Save Settings"
                  action={updateAssessmentSettings.bind(null, assessment.id)}
                >
                  <TextField name="title" label="Title" required maxLength={160} defaultValue={assessment.title} />
                  <SelectField
                    name="kind"
                    label="Kind"
                    required
                    defaultValue={assessment.kind}
                    options={[
                      { value: "PRACTICE", label: "Practice quiz" },
                      { value: "GRADED", label: "Graded assessment" },
                    ]}
                  />
                  <FieldRow>
                    <TextField
                      name="timeLimitMins"
                      label="Time limit (minutes)"
                      type="number"
                      min={1}
                      max={600}
                      hint="Leave empty for no limit."
                      defaultValue={assessment.timeLimitMins ?? undefined}
                    />
                    <TextField
                      name="passingScorePercent"
                      label="Passing score (%)"
                      type="number"
                      min={0}
                      max={100}
                      hint="Leave empty for no pass mark."
                      defaultValue={assessment.passingScorePercent ?? undefined}
                    />
                  </FieldRow>
                  <TextField
                    name="allowedAttempts"
                    label="Allowed attempts"
                    type="number"
                    required
                    min={0}
                    max={20}
                    hint="0 means unlimited."
                    defaultValue={assessment.allowedAttempts}
                  />
                  <CheckboxField name="shuffleQuestions" label="Shuffle questions" hint="Each attempt gets its own fixed order." defaultChecked={assessment.shuffleQuestions} />
                  <CheckboxField
                    name="showResultsImmediately"
                    label="Show results immediately"
                    hint="Learners see their score and the correct answers right after submitting."
                    defaultChecked={assessment.showResultsImmediately}
                  />
                </ModalForm>
              </div>
              <dl className="grid grid-cols-1 gap-md sm:grid-cols-2">
                <Setting label="Kind" value={ASSESSMENT_KIND_LABEL[assessment.kind]} />
                <Setting label="Time limit" value={assessment.timeLimitMins === null ? "No limit" : `${assessment.timeLimitMins} minutes`} />
                <Setting label="Passing score" value={assessment.passingScorePercent === null ? "No pass mark" : `${assessment.passingScorePercent}%`} />
                <Setting label="Allowed attempts" value={assessment.allowedAttempts === 0 ? "Unlimited" : String(assessment.allowedAttempts)} />
                <Setting label="Shuffle questions" value={assessment.shuffleQuestions ? "On" : "Off"} />
                <Setting label="Show results immediately" value={assessment.showResultsImmediately ? "On" : "Off"} />
              </dl>
            </Panel>
          ) : null}

          {tab === "results" ? (
            <Panel className="overflow-hidden">
              <h2 className="p-lg font-headline-md text-headline-md text-on-surface">Results</h2>
              {assessment.attempts.length === 0 ? (
                <p className="p-lg pt-0 font-body-md text-body-md text-on-surface-variant">No one has attempted this assessment yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-y border-outline-variant/40">
                          <th className={TH}>Learner</th>
                          <th className={`${TH} text-right`}>Attempt</th>
                          <th className={TH}>Status</th>
                          <th className={`${TH} text-right`}>Score</th>
                          <th className={TH}>Result</th>
                          <th className={TH}>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assessment.attempts.map((attempt) => (
                          <tr key={attempt.id} className="border-b border-outline-variant/20 last:border-0">
                            <td className="p-md">
                              <p className="font-body-md text-body-md text-on-surface">{attempt.learnerName}</p>
                              <p className="font-label-sm text-label-sm text-on-surface-variant">{attempt.learnerEmail}</p>
                            </td>
                            <td className="p-md text-right font-body-md text-body-md text-on-surface">{attempt.attemptNumber}</td>
                            <td className="p-md font-body-md text-body-md text-on-surface-variant">{ATTEMPT_STATUS_LABEL[attempt.status]}</td>
                            <td className="p-md text-right font-body-md text-body-md text-on-surface">
                              {attempt.scorePercent === null ? "—" : `${Math.round(attempt.scorePercent)}%`}
                            </td>
                            <td className="p-md">
                              {attempt.passed === null ? (
                                <span className="font-body-md text-body-md text-on-surface-variant">—</span>
                              ) : (
                                <StatusPill tone={attempt.passed ? "success" : "error"} dot={false}>
                                  {attempt.passed ? "Passed" : "Not passed"}
                                </StatusPill>
                              )}
                            </td>
                            <td className="whitespace-nowrap p-md font-body-md text-body-md text-on-surface-variant">
                              {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {assessment.attemptCount > assessment.attempts.length ? (
                    <p className="border-t border-outline-variant/40 p-md font-label-md text-label-md text-on-surface-variant">
                      Showing the newest {assessment.attempts.length} of {assessment.attemptCount} attempts.
                    </p>
                  ) : null}
                </>
              )}
            </Panel>
          ) : null}
        </div>

        <aside className="flex flex-col gap-lg">
          <Panel className="flex flex-col gap-lg p-lg">
            <h2 className="font-headline-md text-headline-md text-on-surface">Configuration</h2>
            <dl className="grid grid-cols-2 gap-md">
              <div className="flex flex-col items-center gap-xs rounded-xl bg-surface-container-low p-md">
                <dd className="font-display-lg-mobile text-display-lg-mobile text-primary">{assessment.questions.length}</dd>
                <dt className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Questions</dt>
              </div>
              <div className="flex flex-col items-center gap-xs rounded-xl bg-surface-container-low p-md">
                <dd className="font-display-lg-mobile text-display-lg-mobile text-on-surface">{assessment.totalMarks}</dd>
                <dt className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Total Marks</dt>
              </div>
            </dl>
            <div className="flex flex-col gap-sm">
              <div className="flex items-center justify-between font-label-md text-label-md">
                <span className="text-on-surface-variant">Passing Score</span>
                <span className="text-on-surface">
                  {assessment.passingScorePercent === null ? "No pass mark" : `${assessment.passingScorePercent}% (${passingPoints} pts)`}
                </span>
              </div>
              {assessment.passingScorePercent !== null ? (
                <ProgressBar percent={assessment.passingScorePercent} label="Passing score" tone="bg-primary" />
              ) : null}
            </div>
            {assessment.autoGradedMarks < assessment.totalMarks ? (
              <p className="rounded-lg bg-warning-container p-md font-label-sm text-label-sm text-on-surface">
                Only {assessment.autoGradedMarks} of {assessment.totalMarks} marks are auto-graded — code snippet questions are never
                scored automatically, so a learner&apos;s percentage is out of the full {assessment.totalMarks}.
              </p>
            ) : null}
          </Panel>

          <Panel className="flex flex-col gap-md p-lg">
            <h2 className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">Curriculum Context</h2>
            <div className="flex flex-col gap-md rounded-xl border border-outline-variant/60 p-md">
              <Link href={`/admin/programs/${assessment.program.id}`} className="flex items-start gap-sm hover:text-primary">
                <GraduationCap className="mt-xs h-5 w-5 shrink-0 text-primary" />
                <span className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface">{assessment.program.name}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Program</span>
                </span>
              </Link>
              <Link
                href={`/admin/curriculum?program=${assessment.program.id}`}
                className="ml-md flex items-start gap-sm border-l border-outline-variant pl-md hover:text-primary"
              >
                <Folder className="mt-xs h-5 w-5 shrink-0 text-primary" />
                <span className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface">
                    Module {String(assessment.module.order).padStart(2, "0")}: {assessment.module.title}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {assessment.lesson ? `Quiz lesson: ${assessment.lesson.title}` : "Not linked to a quiz lesson"}
                  </span>
                </span>
              </Link>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  number,
  isFirst,
  isLast,
  locked,
}: {
  question: BuilderQuestion;
  number: number;
  isFirst: boolean;
  isLast: boolean;
  locked: boolean;
}) {
  return (
    <li className="flex flex-col gap-md rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-lg">
      <div className="flex flex-wrap items-center gap-sm">
        <span className="flex h-7 items-center rounded bg-primary-container px-sm font-label-sm text-label-sm text-on-primary">Q{number}</span>
        <span className="rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-on-surface-variant">
          {QUESTION_TYPE_LABEL[question.type]}
        </span>
        <span className="ml-auto font-label-md text-label-md text-on-surface-variant">
          {question.points} pt{question.points === 1 ? "" : "s"}
        </span>
        {locked ? null : (
          <span className="flex items-center gap-xs">
            <ActionButton action={moveQuestion.bind(null, question.id, "up")} variant="icon" label={`Move question ${number} up`} disabled={isFirst}>
              <ArrowUp className="h-4 w-4" />
            </ActionButton>
            <ActionButton action={moveQuestion.bind(null, question.id, "down")} variant="icon" label={`Move question ${number} down`} disabled={isLast}>
              <ArrowDown className="h-4 w-4" />
            </ActionButton>
            <ModalForm
              trigger={<Pencil className="h-4 w-4" />}
              triggerVariant="icon"
              triggerLabel={`Edit question ${number}`}
              title={`Edit Question ${number}`}
              submitLabel="Save Question"
              action={updateQuestion.bind(null, question.id)}
            >
              <QuestionFields
                initial={{
                  type: question.type,
                  text: question.text,
                  points: question.points,
                  explanation: question.explanation,
                  options: question.options.map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
                }}
              />
            </ModalForm>
            <ActionButton action={duplicateQuestion.bind(null, question.id)} variant="icon" label={`Duplicate question ${number}`}>
              <Copy className="h-4 w-4" />
            </ActionButton>
            <ActionButton
              action={deleteQuestion.bind(null, question.id)}
              variant="icon"
              label={`Delete question ${number}`}
              confirm="Delete this question?"
              confirmLabel="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </ActionButton>
          </span>
        )}
      </div>

      <p className="whitespace-pre-line font-body-lg text-body-lg text-on-surface">{question.text}</p>

      {question.type === "CODE_SNIPPET" ? (
        <p className="font-label-md text-label-md text-on-surface-variant">Written answer — not auto-graded.</p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {question.options.map((option) => (
            <li
              key={option.id}
              className={`flex items-center gap-md rounded-lg border px-md py-sm font-body-md text-body-md ${
                option.isCorrect ? "border-primary bg-primary-fixed text-on-surface" : "border-outline-variant/60 text-on-surface"
              }`}
            >
              <span className="w-4 shrink-0 font-label-md text-label-md text-on-surface-variant">{option.label}</span>
              <span className="flex-1">{option.text}</span>
              {option.isCorrect ? (
                <span className="flex shrink-0 items-center gap-xs font-label-sm text-label-sm text-primary">
                  <CircleCheck className="h-4 w-4" /> Correct
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {question.explanation ? (
        <p className="rounded-lg bg-surface-container-low p-md font-body-md text-body-md text-on-surface-variant">
          <span className="font-label-md text-label-md text-on-surface">Explanation: </span>
          {question.explanation}
        </p>
      ) : null}
    </li>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-xs rounded-xl bg-surface-container-low p-md">
      <dt className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</dt>
      <dd className="font-body-md text-body-md text-on-surface">{value}</dd>
    </div>
  );
}
