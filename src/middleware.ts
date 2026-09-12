// Edge runtime — imports ONLY auth.config (never auth.ts / Prisma). All
// routing logic lives in auth.config.ts's `authorized` callback.
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
