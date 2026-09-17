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
// Deliberately NOT used by prisma/bootstrap.ts or bootstrap-curriculum.ts:
// those are the two scripts that are meant to run against Neon.
import { join } from "node:path";

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

export function assertLocalDatabase(): void {
  ensureDatabaseUrlLoaded();

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("assertLocalDatabase: DATABASE_URL is not set. Refusing to run.");
  }

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    throw new Error("assertLocalDatabase: DATABASE_URL is not a parseable URL, so its host can't be checked. Refusing to run.");
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `assertLocalDatabase: refusing to run against non-local database host "${host}". ` +
        "Seed and verify scripts only ever run against localhost/127.0.0.1 (the docker-compose DB). " +
        "Neon is production — see CLAUDE.md. Nothing was connected to.",
    );
  }
}
