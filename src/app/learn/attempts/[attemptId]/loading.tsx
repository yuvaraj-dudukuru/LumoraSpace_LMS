export default function AttemptLoading() {
  return (
    <div className="flex flex-col gap-lg xl:flex-row xl:items-start xl:gap-xl">
      <div className="flex min-w-0 flex-1 flex-col gap-lg">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-md">
          <div className="h-6 w-56 animate-pulse rounded bg-surface-container" />
          <div className="h-5 w-16 animate-pulse rounded bg-surface-container" />
        </div>
        <div className="h-4 w-32 animate-pulse rounded bg-surface-container" />
        <div className="h-1 w-full animate-pulse rounded-full bg-surface-container" />
        <div className="h-7 w-full max-w-lg animate-pulse rounded bg-surface-container" />
        <div className="flex flex-col gap-sm">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-container-low" />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-outline-variant/30 pt-lg">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-container" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-container" />
        </div>
      </div>
      <aside className="w-full shrink-0 xl:w-72">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg">
          <div className="mb-md h-4 w-32 animate-pulse rounded bg-surface-container" />
          <div className="grid grid-cols-5 gap-xs">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-container" />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
