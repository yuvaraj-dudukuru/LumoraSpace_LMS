import { notFound, forbidden } from "next/navigation";
import { requireGrantedEnrollment } from "@/lib/auth-guards";
import { getAttemptForGuard, getLiveAttemptQuestions, getGradedAttemptQuestions } from "@/lib/queries/assessments";
import { submitAttempt } from "./actions";
import { AttemptRunner } from "./attempt-runner";
import { ResultsView } from "./results-view";

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;

  const attempt = await getAttemptForGuard(attemptId);
  if (!attempt) notFound();

  const enrollment = await requireGrantedEnrollment(attempt.programId);
  if (attempt.enrollmentId !== enrollment.id) forbidden();

  const deadline = attempt.timeLimitMins ? attempt.startedAt.getTime() + attempt.timeLimitMins * 60_000 : null;
  const isExpired = attempt.status === "IN_PROGRESS" && deadline !== null && Date.now() > deadline;

  let scorePercent = attempt.scorePercent;
  let passed = attempt.passed;
  let isInProgress = attempt.status === "IN_PROGRESS";

  // TIMER IS SERVER-AUTHORITATIVE: a page load on an expired attempt grades
  // and submits it here, before anything renders — never trusts the client
  // to have submitted on time.
  if (isExpired) {
    const result = await submitAttempt(attemptId);
    if (result.ok) {
      scorePercent = result.scorePercent;
      passed = result.passed;
    }
    isInProgress = false;
  }

  if (isInProgress) {
    const questions = await getLiveAttemptQuestions(attempt.assessmentId, attemptId, attempt.shuffleQuestions);
    return (
      <AttemptRunner
        attemptId={attemptId}
        assessmentTitle={attempt.title}
        deadlineIso={deadline ? new Date(deadline).toISOString() : null}
        questions={questions}
      />
    );
  }

  const questions = attempt.showResultsImmediately
    ? await getGradedAttemptQuestions(attempt.assessmentId, attemptId, attempt.shuffleQuestions)
    : null;

  return (
    <ResultsView
      title={attempt.title}
      scorePercent={scorePercent}
      passed={passed}
      passingScorePercent={attempt.passingScorePercent}
      showResultsImmediately={attempt.showResultsImmediately}
      questions={questions}
    />
  );
}
