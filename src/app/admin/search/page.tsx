import Link from "next/link";
import { GraduationCap, Layers, Search } from "lucide-react";
import { requireRole } from "@/lib/auth-guards";
import { MIN_SEARCH_LENGTH, searchAdmin } from "@/lib/queries/search";
import { Avatar, EmptyState, PageHeader, Panel } from "@/components/admin/ui";

const ROW = "flex items-center gap-md border-b border-outline-variant/30 p-md transition-colors last:border-0 hover:bg-surface-container-low";

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole("ADMIN");
  const query = (await searchParams).q?.trim() ?? "";
  const results = await searchAdmin(query);
  const total = results.users.length + results.programs.length + results.batches.length;

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader
        title="Search"
        description={query ? `Results for "${query}" across users, programs and batches.` : "Search users, programs and batches."}
      />

      {query.length < MIN_SEARCH_LENGTH ? (
        <EmptyState icon={<Search className="h-10 w-10 text-on-surface-variant" />}>
          Type at least {MIN_SEARCH_LENGTH} characters in the search box above.
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState icon={<Search className="h-10 w-10 text-on-surface-variant" />}>
          Nothing matches &quot;{query}&quot;.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-xl">
          {results.users.length > 0 ? (
            <ResultGroup title="Users" count={results.users.length}>
              {results.users.map((user) => (
                <Link key={user.id} href={`/admin/users/${user.id}`} className={ROW}>
                  <Avatar name={user.name} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-label-md text-label-md text-on-surface">{user.name}</span>
                    <span className="truncate font-label-sm text-label-sm text-on-surface-variant">{user.email}</span>
                  </span>
                  <span className="font-label-sm text-label-sm capitalize text-on-surface-variant">
                    {user.role.toLowerCase()}
                  </span>
                </Link>
              ))}
            </ResultGroup>
          ) : null}

          {results.programs.length > 0 ? (
            <ResultGroup title="Programs" count={results.programs.length}>
              {results.programs.map((program) => (
                <Link key={program.id} href={`/admin/programs/${program.id}`} className={ROW}>
                  <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-on-surface">{program.name}</span>
                  <span className="font-label-sm text-label-sm capitalize text-on-surface-variant">
                    {program.status.toLowerCase()}
                  </span>
                </Link>
              ))}
            </ResultGroup>
          ) : null}

          {results.batches.length > 0 ? (
            <ResultGroup title="Batches" count={results.batches.length}>
              {results.batches.map((batch) => (
                <Link key={batch.id} href={`/admin/batches/${batch.id}`} className={ROW}>
                  <Layers className="h-5 w-5 shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-label-md text-label-md text-on-surface">
                      {batch.name} · {batch.code}
                    </span>
                    <span className="truncate font-label-sm text-label-sm text-on-surface-variant">{batch.programName}</span>
                  </span>
                  <span className="font-label-sm text-label-sm capitalize text-on-surface-variant">
                    {batch.status.toLowerCase()}
                  </span>
                </Link>
              ))}
            </ResultGroup>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-sm">
      <h2 className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">
        {title} ({count})
      </h2>
      <Panel className="overflow-hidden">{children}</Panel>
    </section>
  );
}
