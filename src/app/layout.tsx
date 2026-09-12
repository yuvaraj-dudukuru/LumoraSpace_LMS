import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LumoraSpace",
  description: "Cohort-based bootcamp LMS",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
