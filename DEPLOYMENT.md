# Deployment

Environment variables, first-deploy bootstrap, and OAuth setup for running LumoraSpace LMS outside local dev.

## Deploy order (first production deploy: Neon + Vercel)

`npm run build` is `prisma generate && next build` — it never runs migrations. Migrations and the bootstrap are run **by hand, from your own machine, before** the first deploy (and migrations again before any later deploy that ships a new migration). Do them in this order:

1. **Neon** — create the project/database. Copy both connection strings: the **pooled** one (host contains `-pooler`) and the **unpooled/direct** one.
2. **Migrate, with the UNPOOLED URL** — Prisma migrations use advisory locks and long transactions that the pooler can't proxy:
   ```bash
   DATABASE_URL="postgresql://…@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require" npx prisma migrate deploy
   ```
3. **Bootstrap, same UNPOOLED URL** — replace the placeholder content in `prisma/bootstrap-data.json`, delete its `"_template": true` key, check it without a database (`npx tsx scripts/verify-bootstrap-data.ts`), then:
   ```bash
   DATABASE_URL="<unpooled url>" APP_URL="https://learn.yourdomain.com" \
   BOOTSTRAP_ADMIN_EMAIL=you@yourcompany.com \
   BOOTSTRAP_ADMIN_PASSWORD='a-real-password-12-chars-min' \
   BOOTSTRAP_ADMIN_NAME='Your Name' \
   npm run bootstrap
   ```
   It ends with `Sign in at <APP_URL>/login, then remove BOOTSTRAP_ADMIN_PASSWORD from your shell/env.` — do that.
4. **Vercel env vars** — `DATABASE_URL` = the **pooled** URL, `AUTH_SECRET`, `APP_URL` (the exact production origin, no trailing slash), and whichever of `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS`, `S3_*` you're using. Never the `BOOTSTRAP_*` vars. Deploy.
5. **Google redirect URI** — once the production origin exists, add `https://<origin>/api/auth/callback/google` under the OAuth client's authorized redirect URIs (details below). If you use R2, add the CORS rule for that same origin (below).

Later deploys: run step 2 again only when `prisma/migrations/` gained a new migration, then push.

## Environment variables

**Only `DATABASE_URL` and `AUTH_SECRET` are required for the app to build, deploy, and serve every core LMS flow** (enrollment, lessons, quizzes, assignments via GitHub URL/notes, certificates, admin, mentor review). Add `APP_URL` if you want any email to actually be sent. Google OAuth, Resend, and S3 are genuinely optional — each gates one specific enhancement and fails loud-but-contained (never a crashed page, never a failed build) when unset. This was re-verified directly as part of the pre-deployment audit: `getPresignedUploadUrl`/`getResend` both validate lazily (on first real use, not at import/build time — see the note at the bottom of this file), and every call site either already caught the resulting error (`mail.ts`) or has been fixed to (`assignment-file-upload.tsx`, this pass).

| Variable | Required for the app to run? | Used in | If missing |
|---|---|---|---|
| `DATABASE_URL` | **Yes — hard requirement** | `prisma/schema.prisma` (`datasource db { url = env("DATABASE_URL") }`) — every Prisma query in the app goes through this | **Fails loud.** Prisma throws immediately on the first query attempt ("Environment variable not found: DATABASE_URL" or a connection error). Nothing works without it. |
| `AUTH_SECRET` | **Yes — hard requirement in production** | Read implicitly by Auth.js v5 (`src/auth.ts`, `src/auth.config.ts`) to sign/encrypt session JWTs | **Fails loud in production** — Auth.js throws `MissingSecretError` on the first auth request. In development it falls back to a value generated fresh each restart, which silently invalidates every existing session — always set this explicitly, even locally. |
| `AUTH_GOOGLE_ID` | No — optional | Auth.js's `Google` provider (`src/auth.config.ts`), picked up by its own env-var convention — no explicit `process.env` read in this codebase | **Fails at request time, not startup.** The app builds and runs fine with this unset, and email/password sign-in (the `Credentials` provider) works normally; clicking "Continue with Google" redirects to an Auth.js error page instead. |
| `AUTH_GOOGLE_SECRET` | No — optional | Same as `AUTH_GOOGLE_ID` | Same as `AUTH_GOOGLE_ID`. |
| `RESEND_API_KEY` | No — optional | `src/lib/email.ts` — checked lazily, on first actual send | **Fails loud on first use, always caught.** `grantAccess` and `submitReview` both complete their database write and return success regardless; the email send that follows is wrapped in `mail.ts`'s own try/catch, so a missing key only ever produces a server-side log line, never a broken admin/mentor action. Deliberately **not** checked at module load: an earlier version threw at import time, which crashed `next build`'s page-data collection for any page that transitively imports this module (confirmed by reproducing it). |
| `EMAIL_FROM_ADDRESS` | No — optional | `src/lib/mail.ts` | **Silent fallback** to `noreply@lumoraspace.dev`. Set this explicitly for a real deployment — that default won't be a verified sending domain in Resend. |
| `APP_URL` | No — but required for any email to actually go out | `src/lib/mail.ts` — read on every send; every link in every email is built from it (`${APP_URL}/login`, `${APP_URL}/learn/submissions/{id}`) | **Logged and skipped.** When unset (or not an absolute `http(s)` URL) the send is skipped with a `console.warn` and the calling action still succeeds. Set it to the exact deployed origin, e.g. `https://learn.yourdomain.com` — no trailing slash. This is also the origin to allow in the R2 CORS rule below. |
| `S3_ENDPOINT` | No — optional | `src/lib/storage.ts` — checked lazily, on first actual presigned-URL request | **Fails loud on first use, now always caught** (fixed this pass — see below). Assignment submission works fully without it (`githubUrl`/`notes` alone satisfy `submitAssignmentSchema`); only the "attach a file" control on the assignment page is affected. |
| `S3_ACCESS_KEY` | No — optional | `src/lib/storage.ts` | Same as `S3_ENDPOINT`. |
| `S3_SECRET_KEY` | No — optional | `src/lib/storage.ts` | Same as `S3_ENDPOINT`. |
| `S3_BUCKET_NAME` | No — optional | `src/lib/storage.ts` | Same as `S3_ENDPOINT`. |
| `S3_REGION` | No — optional | `src/lib/storage.ts` | **Silent fallback** to `"auto"` (correct for Cloudflare R2; set an explicit AWS region like `us-east-1` if using real S3). |
| `BOOTSTRAP_ADMIN_EMAIL` | Bootstrap-only | `prisma/bootstrap.ts`, Zod-validated | **Fails loud** — printed validation error, `process.exit(1)`, before any database write. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Bootstrap-only (min 12 chars) | `prisma/bootstrap.ts`, Zod-validated | Same as `BOOTSTRAP_ADMIN_EMAIL`. |
| `BOOTSTRAP_ADMIN_NAME` | Bootstrap-only | `prisma/bootstrap.ts`, Zod-validated | Same as `BOOTSTRAP_ADMIN_EMAIL`. |

### Fixed this pass: the file-upload control could hang forever with S3 unconfigured

`getPresignedUploadUrl`'s S3 client was already lazy (previous deployment-prep pass), so a missing `S3_*` var never broke the build. But `src/components/assignment-file-upload.tsx` called the `getAssignmentUploadUrl` Server Action without a `try/catch` — if that action threw (which it does, once, when S3 env vars are missing), the upload control was left stuck on "Uploading…" forever with no error shown and no way to recover except a page refresh. Fixed by wrapping that call the same way the PUT-upload call two lines below it already was, surfacing "File upload isn't available right now. You can still submit with a GitHub link or notes." — the assignment can still be submitted normally.

`NODE_ENV` isn't something you set by hand on most platforms — `next build`/`next start` set it to `production` automatically. It gates the dev-only fallbacks above (`src/lib/prisma.ts`, `src/lib/email.ts`, `src/lib/storage.ts`).

## First deploy: bootstrapping a fresh database

Never run `npm run seed` against a production database — it deletes every row in every table it owns before reseeding (see `prisma/seed.ts`'s own top-of-file comment). It exists for local dev only.

For a real deployment, after running migrations against the new database (see **Deploy order** above — use the unpooled URL for both):

```bash
BOOTSTRAP_ADMIN_EMAIL=you@yourcompany.com \
BOOTSTRAP_ADMIN_PASSWORD='a-real-password-12-chars-min' \
BOOTSTRAP_ADMIN_NAME='Your Name' \
npm run bootstrap
```

This creates exactly one admin account, plus every program (modules, lessons, assessments, assignments, batches) listed in `prisma/bootstrap-data.json`. It refuses outright (exit code 1, no writes) if the `User` table already has any rows. Run it once, by hand, from your own machine against the production `DATABASE_URL` — it is **not** part of the build or deploy.

`prisma/bootstrap-data.json` has the shape `{ "_template": true, "programs": [ { program, modules, assessments, assignments, batches } ] }`. The checked-in file is placeholder content and carries `"_template": true`; **both** bootstrap scripts refuse to load it while that key is present. Replace the placeholders with real content and delete the `_template` key first. The whole file is validated before the first database call (valid ISO dates with `endDate` after `startDate`, every `moduleOrder`/`linkedLessonId` resolving, only `QUIZ` lessons carrying an assessment and every `QUIZ` lesson having one, unique lesson ids and module orders, every `MULTIPLE_CHOICE`/`TRUE_FALSE` question having a correct option) — check a file without touching a database with `npx tsx scripts/verify-bootstrap-data.ts`.

If real users already exist (signups happened before curriculum was loaded), use `npm run bootstrap:curriculum` instead — it never touches `User`, and refuses per program slug that already exists.

## Cloudflare R2: bucket CORS rule (required for file uploads)

The browser uploads directly to the bucket with a presigned `PUT` (`src/components/assignment-file-upload.tsx` → `getPresignedUploadUrl`), and opens files through a presigned `GET` (`getPresignedDownloadUrl`, 5-minute expiry, generated server-side at render time on `/mentor/submissions/[id]` and `/learn/submissions/[id]`). Objects stay **private** — nothing in this app makes the bucket public, and the stored `Submission.fileUrl` is an identifier, not a link that works on its own.

Both browser requests are cross-origin (app origin → `*.r2.cloudflarestorage.com`), so the bucket needs a CORS rule or the `PUT` fails preflight and the upload control shows "Upload failed". In the Cloudflare dashboard: **R2 → your bucket → Settings → CORS policy**, add:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- `AllowedOrigins` is the **exact** app origin (scheme + host, no trailing slash, no wildcard) — the value you set as `APP_URL`. Add a second entry for `http://localhost:3000` if you want uploads to work in local dev against the same bucket.
- `PUT` is the upload; `GET` is the presigned download. Nothing else is needed.
- `Content-Type` and `Content-Length` must be allowed because both are **signed into** the presigned PUT (see `storage.ts`) and the browser sends them on the actual request.

Accepted upload types: PDF, PNG, JPEG, `.doc`, `.docx` — 10 MB max (`src/lib/validations/assignment.ts`). The object key is `assignment-submissions/{uuid}-{sanitized file name}`; the original name is sanitized (basename only, no spaces, `[A-Za-z0-9._-]` only, 100-char cap) before it ever reaches the key.

## Generating `AUTH_SECRET`

```bash
npx auth secret
```

or, without the `auth` CLI:

```bash
openssl rand -base64 32
```

Either produces a random 32+ byte value. Set it as `AUTH_SECRET` in your deployment platform's environment variables — never commit it.

## Google OAuth setup

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or reuse) a project, then go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add the exact URI Auth.js expects — `{your app's origin}/api/auth/callback/google`:
   - Production: `https://yourdomain.com/api/auth/callback/google`
   - Local dev: `http://localhost:3000/api/auth/callback/google`

   This path is fixed by Auth.js's own convention (`/api/auth/callback/<provider>`), not configurable in this codebase — it must match exactly, including scheme and absence of a trailing slash, or Google will reject the callback with a `redirect_uri_mismatch` error.
4. Copy the generated **Client ID** and **Client Secret** into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
5. If your deployment platform assigns a URL only after the first deploy (common with preview environments), you'll need to add that URL's callback as an additional authorized redirect URI after deploying once — Google OAuth doesn't support wildcard domains.

## Security notes from the deployment-readiness audit

- No hardcoded `localhost` URLs, `.env`/`.env.local` file references, or sensitive-data-leaking `console.log`s were found in `src/`. See the audit findings in the corresponding commit for the one low-risk item noted (a dev-only test-data script importing the shared dev password, which never ships in the production build).
- `src/lib/prisma.ts` reuses a single `PrismaClient` in development only (`globalThis.prisma`, guarded by `NODE_ENV !== "production"`) — this is intentional, to survive Next.js's dev-mode hot-reload without exhausting connections; production always gets a fresh client.
- **Never validate a required env var at module scope in a file reachable from a Server Action.** Next's `next build` statically evaluates the module graph of every Server Action reachable from every page during its "collect page data" step — even for a route nobody is actively hitting in that build. A top-level `throw` in such a module (as `src/lib/storage.ts` and `src/lib/email.ts` both originally had) turns a missing production env var into a **build failure**, not a runtime one — reproduced directly while preparing this deployment pass (`/learn/assignments/[assignmentId]` failed "collect page data" over unset `S3_*` vars). Both were refactored to validate lazily instead, inside a cached getter called only when the client is actually used — the same loud error still fires, just at first real use instead of at build time. Follow this pattern for any future required-env-var client (e.g. a new third-party API key).
