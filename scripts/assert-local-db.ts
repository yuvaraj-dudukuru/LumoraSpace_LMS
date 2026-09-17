// Refuses to let dev tooling touch a remote database by accident.
//
// prisma/seed.ts deletes every row it owns and several scripts/verify-*.ts
// write (verify-admin temporarily revokes a certificate), so pointing them at
// the wrong DATABASE_URL is one command away from destroying real data. Every
// such script calls assertLocalDatabase() FIRST — before `new PrismaClient()`,
// before any query — and it throws unless the host is localhost/127.0.0.1
// (the docker-compose DB). The error names the host it refused and never
// the credentials.
//
// The ONE exception (Phase A step 9): a Neon *staging* branch that testers
// use through a Vercel Preview deployment. Set ALLOW_SEED_HOST to exactly
// that branch's hostname for a single command and the host is accepted.
// The production host — the DATABASE_URL host in .env.neon, when that file
// exists — is refused regardless, in both its pooled ("-pooler") and direct
// forms, so ALLOW_SEED_HOST can never be pointed at production by mistake.
// See DEPLOYMENT.md, "Staging branch for testers".
//
// Deliberately NOT used by prisma/bootstrap.ts, bootstrap-curriculum.ts or
// prisma/set-program-status.ts: those are meant to run against Neon.
import { join } from "node:path";
import { readFileSync } from "node:fs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type ProcessWithLoadEnv = NodeJS.Process & { loadEnvFile?: (path?: string) => void };

/** Scripts run with a plain `npx tsx` don't load .env themselves — Prisma
 * Client only does that lazily when it's constructed, which is after this
 * check. So if the shell didn't export DATABASE_URL, read the project .env
 * the same way Prisma would. A value already in the environment always wins
 * (loadEnvFile is only attempted when the var is absent). */
function ensureDatabaseUrlLoaded(): void {
  if (process.env.DATABASE_URL) return;
  const proc = process as ProcessWithLoadEnv;
  if (typeof proc.loadEnvFile !== "function") return;
  try {
    proc.loadEnvFile(join(__dirname, "..", ".env"));
  } catch {
    // No .env — the "not set" error below is the right outcome.
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Neon exposes one database under two hostnames (direct and "-pooler");
 * compare them as one host. */
export function normalizeNeonHost(host: string): string {
  return host.toLowerCase().replace("-pooler", "");
}

/** The production database host: the DATABASE_URL host in .env.neon (next to
 * .env), or null when that file is absent or has no parseable URL. Reads the
 * file text directly (never through process.env) and returns the host only —
 * credentials never leave this function. */
export function productionHostFromEnvNeon(): string | null {
  try {
    const text = readFileSync(join(__dirname, "..", ".env.neon"), "utf-8");
    const line = text.split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
    if (!line) return null;
    const raw = line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
    return hostOf(raw);
  } catch {
    return null;
  }
}

/** ALLOW_SEED_HOST as a bare hostname, or null when unset. Anything that
 * isn't a bare hostname (a scheme, path, port, credentials, whitespace) is
 * a configuration mistake and is refused outright rather than ignored. */
function allowedSeedHost(): string | null {
  const raw = process.env.ALLOW_SEED_HOST?.trim();
  if (!raw) return null;
  if (/[/:@\s]/.test(raw)) {
    throw new Error(
      `assertLocalDatabase: ALLOW_SEED_HOST must be a bare hostname such as "ep-xxxx.region.aws.neon.tech" (got "${raw}"). Refusing to run.`,
    );
  }
  return raw;
}

export function assertLocalDatabase(): void {
  ensureDatabaseUrlLoaded();

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("assertLocalDatabase: DATABASE_URL is not set. Refusing to run.");
  }

  const host = hostOf(raw);
  if (host === null) {
    throw new Error("assertLocalDatabase: DATABASE_URL is not a parseable URL, so its host can't be checked. Refusing to run.");
  }

  if (LOCAL_HOSTS.has(host)) return;

  // Production is refused before the allow-list is even consulted.
  const productionHost = productionHostFromEnvNeon();
  if (productionHost !== null && normalizeNeonHost(host) === normalizeNeonHost(productionHost)) {
    throw new Error(
      `assertLocalDatabase: refusing to run against the PRODUCTION database host "${host}" ` +
        "(the DATABASE_URL host in .env.neon). ALLOW_SEED_HOST does not override this. Nothing was connected to.",
    );
  }

  const allowed = allowedSeedHost();
  if (allowed !== null && normalizeNeonHost(host) === normalizeNeonHost(allowed)) return;

  throw new Error(
    `assertLocalDatabase: refusing to run against non-local database host "${host}". ` +
      "Seed and verify scripts only ever run against localhost/127.0.0.1 (the docker-compose DB), or a Neon " +
      `staging branch named explicitly with ALLOW_SEED_HOST=${host} for one command (DEPLOYMENT.md). ` +
      "Neon production is refused either way — see CLAUDE.md. Nothing was connected to.",
  );
}
