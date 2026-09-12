export default function LessonLoading() {
  return (
    <div className="flex flex-col gap-xl xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-sm">
          <div className="h-4 w-28 animate-pulse rounded bg-surface-container" />
          <div className="h-4 w-4 animate-pulse rounded bg-surface-container" />
          <div className="h-4 w-24 animate-pulse rounded bg-surface-container" />
          <div className="h-4 w-4 animate-pulse rounded bg-surface-container" />
          <div className="h-4 w-36 animate-pulse rounded bg-surface-container" />
        </div>

        {/* Video block */}
        <div className="aspect-video animate-pulse rounded-2xl bg-inverse-surface/10" />

        {/* Header: module label + title + duration */}
        <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-xs">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-container" />
            <div className="h-8 w-80 max-w-full animate-pulse rounded-lg bg-surface-container" />
            <div className="h-4 w-16 animate-pulse rounded bg-surface-container" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-lg bg-surface-container" />
        </div>

        {/* Description content area */}
        <div className="flex flex-col gap-sm">
          <div className="h-4 w-full animate-pulse rounded bg-surface-container" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-surface-container" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-surface-container" />
        </div>

        {/* Notes area */}
        <div className="h-32 animate-pulse rounded-2xl bg-surface-container-low" />

        {/* Prev / Next navigation */}
        <div className="flex items-center justify-between border-t border-outline-variant/30 pt-lg">
          <div className="h-5 w-32 animate-pulse rounded bg-surface-container" />
          <div className="h-5 w-32 animate-pulse rounded bg-surface-container" />
        </div>
      </div>

      {/* Right curriculum sidebar */}
      <aside className="w-full shrink-0 xl:w-80">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg">
          <div className="mb-md h-4 w-40 animate-pulse rounded bg-surface-container" />
          <div className="flex flex-col gap-xs">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-lg bg-surface-container"
              />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
