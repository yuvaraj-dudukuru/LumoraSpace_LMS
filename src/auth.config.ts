// Edge-safe Auth.js config. Imported by BOTH src/auth.ts (full, Node runtime)
// and src/middleware.ts (Edge runtime). MUST NOT import Prisma, bcrypt, or
// anything from src/lib/prisma.ts — directly or transitively — or the Edge
// build breaks. The Credentials provider's authorize() needs Prisma, so it is
// added in src/auth.ts instead; this file only lists Google.
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Role } from "@prisma/client";

function roleHome(role: Role, onboardingComplete: boolean): string {
  if (role === "ADMIN") return "/admin";
  if (role === "MENTOR") return "/mentor";
  return onboardingComplete ? "/learn" : "/onboarding";
}

const PUBLIC_EXACT_PATHS = new Set<string>(["/", "/login", "/signup"]);
const PUBLIC_PATH_PREFIXES = ["/programs", "/verify", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const PROTECTED_PREFIXES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/learn", roles: ["LEARNER", "ADMIN"] },
  { prefix: "/mentor", roles: ["MENTOR", "ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
];

// Payload shape accepted from the client's `useSession().update(...)` call —
// validated here (not trusted) even though it never touches Prisma in this file.
const jwtUpdateSchema = z
  .object({ onboardingComplete: z.boolean() })
  .partial();

export default {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.onboardingComplete = user.onboardingComplete;
      }
      if (trigger === "update") {
        const parsed = jwtUpdateSchema.safeParse(session);
        if (parsed.success && parsed.data.onboardingComplete !== undefined) {
          token.onboardingComplete = parsed.data.onboardingComplete;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.onboardingComplete = token.onboardingComplete;
      return session;
    },
    // Coarse gating only — fast, edge-safe, reads the token's role/onboarding
    // flags without hitting the DB. Fine-grained checks (does THIS mentor own
    // THIS batch, is THIS enrollment granted) happen server-side in
    // src/lib/auth-guards.ts, which always re-verifies against Prisma.
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      if (pathname === "/") {
        if (user) {
          return NextResponse.redirect(
            new URL(roleHome(user.role, user.onboardingComplete), request.url),
          );
        }
        return true;
      }

      if (isPublicPath(pathname)) return true;

      if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
        if (!user) return NextResponse.redirect(new URL("/login", request.url));
        if (user.role !== "LEARNER") {
          return NextResponse.redirect(
            new URL(roleHome(user.role, user.onboardingComplete), request.url),
          );
        }
        return true;
      }

      for (const { prefix, roles } of PROTECTED_PREFIXES) {
        if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
          if (!user) return NextResponse.redirect(new URL("/login", request.url));
          if (!roles.includes(user.role)) {
            return NextResponse.redirect(
              new URL(roleHome(user.role, user.onboardingComplete), request.url),
            );
          }
          if (prefix === "/learn" && user.role === "LEARNER" && !user.onboardingComplete) {
            return NextResponse.redirect(new URL("/onboarding", request.url));
          }
          return true;
        }
      }

      // Not in the public allowlist and not under a protected prefix: default
      // to public. M2 only needs to lock down /learn, /mentor, /admin, and
      // /onboarding — pre-emptively blocking hypothetical future routes isn't
      // this milestone's job.
      return true;
    },
  },
} satisfies NextAuthConfig;
