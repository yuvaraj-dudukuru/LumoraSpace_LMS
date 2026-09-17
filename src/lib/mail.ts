import "server-only";
import { render } from "@react-email/components";
import { getResend } from "@/lib/email";
import AccessGrantedEmail from "@/emails/AccessGrantedEmail";
import AssignmentReviewedEmail, { type AssignmentReviewedOutcome } from "@/emails/AssignmentReviewedEmail";

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? "noreply@lumoraspace.dev";

// The ONLY file the rest of the app should import to send email. Every
// function below is fail-safe by design: a Resend outage, a bad API key, or
// a missing APP_URL must never crash the Server Action that called it or
// roll back the DB write that already happened — so failures are logged,
// never thrown.
//
// Every link in an outgoing email is ABSOLUTE and built here from APP_URL
// (scheme + host, no trailing slash — e.g. https://learn.example.com).
// Callers pass app-relative paths only; they never assemble URLs
// themselves. If APP_URL is unset or not an absolute http(s) URL, the send
// is logged and skipped — a relative "/login" in an email body is a dead
// link in every mail client, so sending would be worse than not sending.

/** Read fresh on every call (not cached at module scope) so a value set
 * after boot — or missing in one environment — is picked up correctly. */
function resolveAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return raw.replace(/\/+$/, "");
}

function absoluteAppUrl(appUrl: string, path: string): string {
  return `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function logSkippedForMissingAppUrl(emailName: string, to: string): void {
  console.warn(`${emailName}: APP_URL is not set (or not an absolute http(s) URL) — skipping send to ${to}`);
}

export type AccessGrantedEmailInput = {
  learnerName: string;
  programName: string;
};

export async function sendAccessGrantedEmail(to: string, input: AccessGrantedEmailInput): Promise<void> {
  const appUrl = resolveAppUrl();
  if (!appUrl) {
    logSkippedForMissingAppUrl("sendAccessGrantedEmail", to);
    return;
  }

  try {
    const html = await render(
      AccessGrantedEmail({
        learnerName: input.learnerName,
        programName: input.programName,
        loginUrl: absoluteAppUrl(appUrl, "/login"),
      }),
    );
    const result = await getResend().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `You're in! Access to ${input.programName} granted`,
      html,
    });
    if (result.error) {
      console.error("sendAccessGrantedEmail: Resend API error", result.error);
    }
  } catch (error) {
    console.error("sendAccessGrantedEmail failed", error);
  }
}

export type AssignmentReviewedEmailInput = {
  learnerName: string;
  assignmentTitle: string;
  outcome: AssignmentReviewedOutcome;
  /** The learner-facing submission id — becomes `${APP_URL}/learn/submissions/{id}`. */
  submissionId: string;
};

export async function sendAssignmentReviewedEmail(to: string, input: AssignmentReviewedEmailInput): Promise<void> {
  const appUrl = resolveAppUrl();
  if (!appUrl) {
    logSkippedForMissingAppUrl("sendAssignmentReviewedEmail", to);
    return;
  }

  try {
    const html = await render(
      AssignmentReviewedEmail({
        learnerName: input.learnerName,
        assignmentTitle: input.assignmentTitle,
        outcome: input.outcome,
        reviewUrl: absoluteAppUrl(appUrl, `/learn/submissions/${input.submissionId}`),
      }),
    );
    const subject =
      input.outcome === "APPROVED"
        ? `${input.assignmentTitle}: approved`
        : `${input.assignmentTitle}: revisions requested`;
    const result = await getResend().emails.send({ from: FROM_ADDRESS, to, subject, html });
    if (result.error) {
      console.error("sendAssignmentReviewedEmail: Resend API error", result.error);
    }
  } catch (error) {
    console.error("sendAssignmentReviewedEmail failed", error);
  }
}
