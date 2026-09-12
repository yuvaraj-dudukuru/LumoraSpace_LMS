import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() from next/navigation, used by
    // src/lib/auth-guards.ts to render a real 403/401 instead of a 404.
    authInterrupts: true,
  },
};

export default nextConfig;
