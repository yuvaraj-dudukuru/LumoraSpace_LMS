# LumoraSpace LMS — Agent Prompt Pack

Repo: `github.com/yuvaraj-dudukuru/LumoraSpace_LMS` (Stitch export lives in `design/stitch/`: ~85 screen folders, each with `.html` + `.png`)

---

## 0. Decisions made before any prompt runs

Lock these in. Agents produce garbage when the stack is left open.

| Concern | Decision | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Stitch emits Tailwind HTML; one repo, no CORS, no separate API deploy. Server Components kill most of your data-fetching boilerplate. |
| Styling | **Tailwind v4 + shadcn/ui** | Stitch output is already Tailwind classes — near-direct mapping. shadcn gives you accessible primitives you'd otherwise hand-roll. |
| DB / ORM | **PostgreSQL (Neon or Supabase) + Prisma** | You already know Prisma from Academy. Don't relearn a stack mid-project. |
| Auth | **Auth.js v5, Prisma adapter, JWT sessions, `role` on User** | Credentials + Google. Roles are a first-class MVP requirement here, not an afterthought. |
| Files | Supabase Storage or Cloudflare R2 | Assignment submissions, avatars, resources. |
| Video | MVP: unlisted YouTube / Vimeo embed. Later: Mux or Bunny Stream | Real video infra is a production-phase problem, not MVP. |
| Payments | **Stubbed in MVP.** Razorpay in Phase 2 | Payment screens exist in the export; build the UI, fake the gateway. |
| Mobile | Responsive breakpoints, **not** separate routes | `*_mobile` folders = reference for `sm:` layouts. |

### Domain model implied by the folder names

The export describes a **cohort bootcamp**, not a course marketplace. That distinction drives the whole schema:

```
Program (e.g. "Forge Data Analyst", "Full Stack Developer")
  └── Course
        └── Module
              └── Lesson  ── content blocks (video / text / code)
Batch  (a dated, cohort instance of a Program — "Batch 04")
  ├── Enrollment (Learner ↔ Batch)
  ├── Session (live class, e.g. "SQL Q&A")
  └── Mentor assignment
Assessment ── Question ── Attempt ── Answer
Assignment ── Submission ── Review (mentor feedback)
Certificate (issued on batch/program completion, has a public verify ID)
Payment (Enrollment ↔ transaction)
```

Roles: `LEARNER`, `MENTOR`, `ADMIN`.

### MVP cut — 16 screens, not 85

**In:** landing, login, signup, onboarding (collapse the 4 into 1 form), student dashboard home, my learning, explore programs, program detail, course curriculum, lesson experience, quiz interface, certificates + certificate detail, mentor dashboard, review submission, admin dashboard, admin programs/batches/learners/enrollments (CRUD tables).

**Deferred to Phase 2:** community, practice hub, analytics, payments, resources, sessions, notifications, all settings sub-pages, assessment builder, every `*_mobile` variant as a distinct page.

---

## PROMPT 0 — Spec extraction (run this FIRST, in any agent)

Run this before any code exists. Review its output yourself before moving on. If the schema is wrong here, every later prompt inherits the mistake.

```
You are working in a repo containing a Google Stitch design export. Each top-level
folder is one screen and contains an HTML file (Tailwind markup) and a PNG render.
There is no application code yet.

Your ONLY task this session is to produce specification documents. Write ZERO
application code. Do not scaffold a project. Do not install dependencies.

Step 1 — Inventory
Read every screen folder. For each, record: folder name, the screen's purpose,
which role sees it (LEARNER / MENTOR / ADMIN / PUBLIC), whether it is a desktop or
mobile variant, and every distinct piece of data displayed on it.
Write this to /docs/SCREEN_INVENTORY.md as a table.

Step 2 — Design tokens
Extract the shared visual system from the HTML: color palette (with hex values and
semantic names), font families and type scale, spacing rhythm, border radii,
shadows, and the standard button/input/card variants. Write /docs/DESIGN_TOKENS.md
and a ready-to-paste Tailwind v4 @theme block.

Step 3 — Data model
Derive the database schema from what the screens actually display. Every string,
number, badge, date, and progress bar in the UI is a field somewhere. Note the
domain is a COHORT BOOTCAMP: Programs contain Courses contain Modules contain
Lessons; Batches are dated cohort instances of a Program that learners enroll into.
Write /docs/DATA_MODEL.md as a Prisma schema with comments explaining each relation,
plus a list of any field you had to invent because the UI implied it but did not
show it.

Step 4 — API surface
For each screen, list the reads and writes it needs. Group them into endpoints or
server actions. Write /docs/API.md with method, path, auth role required, request
shape, response shape.

Step 5 — Open questions
Write /docs/OPEN_QUESTIONS.md listing every ambiguity you resolved by guessing, and
what you guessed. Be specific — "unclear whether Reviews are course ratings or
mentor feedback on submissions; assumed the latter based on the review_submission
screen" is useful; "some things were unclear" is not.

Do not proceed past Step 5. Stop and report.
```

---

## PROMPT 1 — Claude Code (primary builder)

Claude Code handles long-horizon, multi-file work best. Use it for architecture, schema, auth, and anything touching more than three files at once.

**Setup before you paste this:** create `CLAUDE.md` at repo root containing the stack table above + a "never do this" list. Claude Code reads it on every turn — it's the cheapest quality lever you have.

```
Read /docs/SCREEN_INVENTORY.md, /docs/DATA_MODEL.md, /docs/API.md,
/docs/DESIGN_TOKENS.md and CLAUDE.md before planning.

GOAL: a working MVP of the LumoraSpace LMS. Cohort bootcamp platform, three roles
(LEARNER, MENTOR, ADMIN).

STACK (non-negotiable): Next.js 15 App Router, TypeScript strict, Tailwind v4,
shadcn/ui, Prisma + PostgreSQL, Auth.js v5 with JWT sessions and a role field,
Zod for all input validation. Server Components for reads, Server Actions for
writes. No client-side data fetching unless the interaction genuinely requires it.

THE STITCH HTML IS A SPEC, NOT A CODEBASE. Never copy a Stitch HTML file into the
app. It is flat, non-componentized markup with duplicated classes. Read it, extract
the layout and tokens, then write real React components. Match the PNG visually;
do not match the HTML structurally.

Ignore every folder ending in _mobile as a separate screen. Use those PNGs only as
reference for how the desktop layout should collapse at sm/md breakpoints.

Work in milestones. STOP after each one and report what you built and what you
skipped. Do not start the next milestone until I say continue.

M1 — Foundation
  Scaffold Next.js. Apply design tokens to Tailwind config. Install and theme
  shadcn/ui. Prisma schema from DATA_MODEL.md + initial migration. Seed script
  with: 2 programs, 4 courses, ~20 lessons, 2 batches, 1 admin, 2 mentors,
  10 learners with varied progress, 1 assessment with 8 questions, 2 assignments
  with submissions in different review states. Verify `npm run build` passes.

M2 — Auth and shell
  Auth.js: credentials + Google, signup, login, session with role. Middleware
  enforcing role-based route protection for /learn, /mentor, /admin. Onboarding
  flow (collapse the four Stitch onboarding screens into one multi-step form).
  App shell: sidebar, topbar, responsive nav — matching the Stitch screens.

M3 — Learner experience
  Dashboard home, my learning, explore programs, program detail, course curriculum,
  lesson experience with progress tracking that persists per lesson and rolls up to
  course and program completion percentages.

M4 — Assessments and certificates
  Quiz interface: timed attempt, question navigation, autosave per answer, submit,
  auto-grade MCQs, results view. Certificate issuance on completion with a public
  verification page at /verify/[certificateId].

M5 — Mentor and admin
  Mentor dashboard + submission review queue + feedback form. Admin dashboard with
  CRUD tables for programs, courses, batches, learners, enrollments.

CONSTRAINTS
- TypeScript strict. No `any`. No `@ts-ignore`.
- Every Server Action validates input with Zod and re-checks the caller's role
  server-side. Never trust the client to enforce a role.
- Every list view handles empty, loading, and error states.
- Run `npm run build` and `npx tsc --noEmit` before declaring a milestone done.
  Report the actual output. Do not claim something works that you have not run.
- If DATA_MODEL.md is wrong or insufficient for a milestone, stop and tell me
  instead of silently improvising a schema change.
```

**How to run it:** use plan mode (`shift+tab` twice) before each milestone, read the plan, correct it, then approve. Commit at every milestone boundary. If a milestone balloons, `/clear` and start the next one fresh with the docs as context.

---

## PROMPT 2 — Antigravity (UI fidelity + verification)

Antigravity's edge is the browser tool — it can run your app, screenshot it, and compare against the Stitch PNG. Use it for pixel work and visual QA, not schema design.

```
Repo context: Next.js 15 + Tailwind v4 + shadcn/ui LMS. Design source of truth is
the Stitch export in design/stitch/ — each folder has an HTML file and a PNG render.
Specs are in /docs/.

TASK: bring the implemented screens to visual parity with the Stitch designs, and
verify each one in the browser.

Write an implementation plan artifact first. Wait for my approval before editing.

For each screen in this list:
  [paste the specific screens you want, e.g.:
   student_dashboard_home, my_learning_lumoraspace, course_curriculum,
   lesson_experience_middleware_security, quiz_interface_sql_fundamentals_assessment]

  1. Open the folder's PNG and study the layout, spacing, and hierarchy.
  2. Open the corresponding route in the running dev server with the browser tool.
  3. Screenshot it. Diff against the PNG: spacing, type scale, color, component
     states, responsive behaviour.
  4. Fix the React components — not by copying Stitch HTML, but by adjusting the
     existing components. Reuse shadcn primitives. Extract anything used on 3+
     screens into /components/ui or /components/shared.
  5. Re-screenshot and confirm. Attach before/after in your walkthrough.
  6. Check the matching *_mobile PNG and verify the responsive collapse at 375px.

RULES
- Do not change the Prisma schema, API routes, or Server Actions. Presentation only.
  If a screen needs data the API does not provide, log it in /docs/OPEN_QUESTIONS.md
  and render a clearly-marked placeholder.
- No inline styles. No arbitrary Tailwind values unless the design token genuinely
  does not exist — if it does not, add it to the theme instead.
- Every interactive element needs keyboard focus states and an accessible label.
- Produce a walkthrough artifact at the end: what changed, per screen, with
  screenshots.
```

---

## PROMPT 3 — OpenCode (free tier)

Be realistic about this one. Free-tier models have small context and weak long-horizon planning. **Do not give OpenCode architecture work.** It is a grunt-work tool: one component, one file, fully specified, at a time. It'll waste your time and produce plausible-looking wrong code if you aim it at anything bigger.

Use it after the skeleton exists, for repetitive conversions. Reusable template:

```
Project: Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui.
Server Components by default. Server Actions for mutations.

Read ONLY these files. Do not explore the rest of the repo:
  - <stitch_folder>/<file>.html        (design reference — DO NOT COPY THIS CODE)
  - /components/shared/<ExistingSimilarComponent>.tsx   (follow this file's style)
  - /docs/DESIGN_TOKENS.md

TASK: create exactly one file at <exact/target/path.tsx> — a React component named
<ComponentName>.

Props (use these exact types, do not invent extras):
  <paste the exact TypeScript interface>

Requirements:
  - Server Component unless it needs state or event handlers. If it needs those,
    mark 'use client' and say why in a one-line comment at the top.
  - Use only Tailwind classes that map to tokens in DESIGN_TOKENS.md.
  - No arbitrary values like w-[437px]. No inline styles.
  - Handle the empty state.
  - Responsive: stacks on mobile, matches the PNG on desktop.

DO NOT:
  - create or modify any other file
  - touch the Prisma schema, API routes, or auth
  - install packages
  - copy markup from the Stitch HTML — read it for layout intent, then write clean
    JSX yourself

Output the single file. Then list any assumption you made.
```

**Good OpenCode tasks:** one card component, one table, one form, one empty state, one skeleton loader, Zod schema from an existing Prisma model, seed data expansion.

**Bad OpenCode tasks:** "build the auth flow", "wire up the dashboard", "design the schema", anything spanning multiple files. Give those to Claude Code.

---

## Division of labour

| Work | Tool |
|---|---|
| Spec extraction (Prompt 0) | Claude Code |
| Schema, migrations, auth, RBAC, Server Actions, business logic | Claude Code |
| Visual parity, responsive QA, browser verification | Antigravity |
| Single components, forms, tables, Zod schemas, seed data | OpenCode |
| Reviewing all of it | You. Non-negotiable. |

---

## Sequencing

1. Run Prompt 0. **Read `/docs/DATA_MODEL.md` yourself, line by line.** A wrong schema here costs you weeks later.
2. Answer everything in `OPEN_QUESTIONS.md` before writing code.
3. Claude Code M1 → M5, committing at each boundary.
4. Antigravity pass for visual parity.
5. Deploy the MVP (Vercel + Neon). Get it in front of one real batch.
6. **Only then** Phase 2: payments, live sessions, community, analytics, practice hub, real video infra.

## Things that will bite you

- **Progress tracking** is harder than it looks. Decide early: is a lesson complete on video-watched-percentage, on an explicit "mark complete", or on quiz pass? Different answers, different schema.
- **Quiz autosave** — if you save only on submit, one dropped connection loses a learner's whole attempt. Save per answer.
- **Certificate verification** must work for a logged-out stranger. Public route, no auth, opaque ID.
- **Batch vs. self-paced.** Your export implies cohorts. If the product also needs self-paced enrollment, the schema must allow an Enrollment with a null Batch — decide now, not in month three.
- Agents will confidently tell you a milestone "works". Run the app yourself after every one.