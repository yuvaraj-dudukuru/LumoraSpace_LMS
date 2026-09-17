## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).


# LumoraSpace LMS

Cohort-based bootcamp LMS. Three roles: LEARNER, MENTOR, ADMIN.

The Google Stitch design export lives in `design/stitch/` — ~85 folders, each
with an HTML file (Tailwind markup) and a PNG render. This is design reference only.

## Stack — do not deviate without asking

- Next.js 15, App Router, TypeScript strict mode
- Tailwind v4 + shadcn/ui
- Prisma + PostgreSQL
- Auth.js v5, Prisma adapter, JWT sessions, `role` field on User
- Zod for all input validation
- Server Components for reads, Server Actions for writes

## Domain model

```
Program → Module → Lesson            (no Course level; Lesson.assessmentId links a
                                      QUIZ lesson to its Assessment → Question →
                                      Attempt → Answer)
Batch        = a dated cohort instance of a Program
Enrollment   = Learner ↔ Program + Batch (programId, batchId, accessState:
               AWAITING | GRANTED | SUSPENDED — content is gated on GRANTED)
Assignment   → Submission → Review / RubricScore   (module-level, mentor-graded)
Certificate  = issued on 100% completion, publicly verifiable by number
```

## Hard rules

- **Read `docs/CONTRACTS.md` before touching `src/lib`.** It is the index of
  every query/guard/action contract and the rules behind them; if the source
  and the doc disagree, fix the doc in the same change.
- **Never run seed or verify scripts against a non-local DB. Neon is production.**
  `.env` points at the docker-compose DB; the Neon URL lives only in `.env.neon`
  and is loaded per-command. `prisma/seed.ts` and every DB-using script under
  `scripts/` call `assertLocalDatabase()` first and refuse any host other than
  localhost/127.0.0.1. Only `prisma/bootstrap*.ts` may target Neon.
- **Never copy Stitch HTML into the app.** It is flat, non-componentized markup with
  duplicated classes. Read it for layout intent, match the PNG visually, then write
  clean React components.
- **Ignore `*_mobile` folders as separate screens.** They are responsive references
  for how the desktop layout collapses at `sm:` / `md:`.
- No `any`. No `@ts-ignore`.
- Every Server Action validates with Zod and re-checks the caller's role server-side.
  Never trust the client to enforce a role.
- Every list view handles empty, loading, and error states.
- No arbitrary Tailwind values (`w-[437px]`). If a token is missing, add it to the
  theme.
- Run `npm run build` and `npx tsc --noEmit` before claiming work is done. Report the
  actual output. Never claim something works that you have not run.
- If the schema in `/docs/DATA_MODEL.md` is insufficient for a task, stop and say so
  instead of silently improvising a change.

## Working style

- Work in milestones. Stop and report after each. Do not start the next without
  being told to continue.
- Use plan mode before any milestone that touches more than three files.