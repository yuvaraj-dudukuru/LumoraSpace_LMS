import "server-only";
import { render } from "@react-email/components";
import { resend } from "@/lib/email";
import AccessGrantedEmail, { type AccessGrantedEmailProps } from "@/emails/AccessGrantedEmail";
import AssignmentReviewedEmail, { type AssignmentReviewedEmailProps } from "@/emails/AssignmentReviewedEmail";

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? "noreply@lumoraspace.dev";

// The ONLY file the rest of the app should import to send email. Both
// functions below are fail-safe by design: a Resend outage or a bad API key
// must never crash the Server Action that called them or roll back the DB
// write that already happened — so failures are logged, never thrown.

export async function sendAccessGrantedEmail(to: string, props: AccessGrantedEmailProps): Promise<void> {
  try {
    const html = await render(AccessGrantedEmail(props));
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `You're in! Access to ${props.programName} granted`,
      html,
    });
    if (result.error) {
      console.error("sendAccessGrantedEmail: Resend API error", result.error);
    }
  } catch (error) {
    console.error("sendAccessGrantedEmail failed", error);
  }
}

export async function sendAssignmentReviewedEmail(to: string, props: AssignmentReviewedEmailProps): Promise<void> {
  try {
    const html = await render(AssignmentReviewedEmail(props));
    const subject =
      props.outcome === "APPROVED"
        ? `${props.assignmentTitle}: approved`
        : `${props.assignmentTitle}: revisions requested`;
    const result = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    if (result.error) {
      console.error("sendAssignmentReviewedEmail: Resend API error", result.error);
    }
  } catch (error) {
    console.error("sendAssignmentReviewedEmail failed", error);
  }
}
