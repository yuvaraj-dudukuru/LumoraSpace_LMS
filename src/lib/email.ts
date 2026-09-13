import "server-only";
import { Resend } from "resend";

// Missing in development is fine (no emails sent locally without a key — see
// mail.ts's try/catch, which absorbs the resulting send failure). Missing
// anywhere else is a real misconfiguration and should fail loudly at import
// time rather than silently no-op in production.
if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "development") {
  throw new Error(
    "RESEND_API_KEY is not set. Required outside development — see .env.example.",
  );
}

export const resend = new Resend(process.env.RESEND_API_KEY);
