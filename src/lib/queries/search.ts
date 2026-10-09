import "server-only";
import type { BatchStatus, ContentStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** The admin top-bar search (/admin/search). ADMIN-only caller, so nothing
 * is scoped. Case-insensitive "contains" over the few fields an admin would
 * type; each group is capped so one broad query can't return the database. */

const GROUP_LIMIT = 8;
export const MIN_SEARCH_LENGTH = 2;

export type AdminSearchResults = {
  users: { id: string; name: string; email: string; role: Role }[];
  programs: { id: string; name: string; status: ContentStatus }[];
  batches: { id: string; name: string; code: string; programName: string; status: BatchStatus }[];
};

export async function searchAdmin(query: string): Promise<AdminSearchResults> {
  const q = query.trim();
  if (q.length < MIN_SEARCH_LENGTH) return { users: [], programs: [], batches: [] };
  const contains = { contains: q, mode: "insensitive" as const };

  const [users, programs, batches] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ name: contains }, { email: contains }] },
      orderBy: { name: "asc" },
      take: GROUP_LIMIT,
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.program.findMany({
      where: { OR: [{ name: contains }, { slug: contains }] },
      orderBy: { name: "asc" },
      take: GROUP_LIMIT,
      select: { id: true, name: true, status: true },
    }),
    prisma.batch.findMany({
      where: { OR: [{ name: contains }, { code: contains }, { program: { name: contains } }] },
      orderBy: { startDate: "desc" },
      take: GROUP_LIMIT,
      select: { id: true, name: true, code: true, status: true, program: { select: { name: true } } },
    }),
  ]);

  return {
    users,
    programs,
    batches: batches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      code: batch.code,
      programName: batch.program.name,
      status: batch.status,
    })),
  };
}
