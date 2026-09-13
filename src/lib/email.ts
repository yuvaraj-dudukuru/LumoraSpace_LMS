import "server-only";
import { Resend } from "resend";

let cachedClient: Resend | null = null;

/** Lazily constructs (and caches) the Resend client on first actual use,
 * rather than throwing at module load. A top-level throw here fires the
 * moment ANYTHING imports this module, including during Next's build-time
 * "collect page data" step, which statically evaluates every Server
 * Action's module graph — even for a route nobody is actively hitting. That
 * turns a missing env var at BUILD time into a fatal, whole-page build
 * failure rather than a runtime one (see the identical fix and its
 * discovery in src/lib/storage.ts for the confirmed repro). Deferring to
 * first real call means the same loud error still fires — just at the
 * first actual send attempt, not at build time for an unrelated page. */
function getResendClient(): Resend {
  if (cachedClient) return cachedClient;

  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "development") {
    throw new Error("RESEND_API_KEY is not set. Required outside development — see .env.example.");
  }

  cachedClient = new Resend(process.env.RESEND_API_KEY);
  return cachedClient;
}

export function getResend(): Resend {
  return getResendClient();
}
