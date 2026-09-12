import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    onboardingComplete: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      onboardingComplete: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    onboardingComplete: boolean;
  }
}
