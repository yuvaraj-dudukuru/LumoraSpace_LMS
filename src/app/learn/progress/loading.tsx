export default function ProgressLoading() {
  return (
    <div className="flex flex-col gap-2xl pb-2xl">
      {/* Header */}
      <div>
        <div className="h-10 w-2/3 max-w-md animate-pulse rounded-lg bg-surface-container" />
        <div className="mt-sm h-5 w-1/2 max-w-sm animate-pulse rounded-lg bg-surface-container" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-md md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-container-low" />
        ))}
      </div>

      {/* Weekly Activity */}
      <div>
        <div className="mb-lg flex items-center justify-between">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-surface-container" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-surface-container" />
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-surface-container-low" />
      </div>

      {/* Active Courses + Sidebar */}
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-md lg:col-span-2">
          <div className="mb-sm h-7 w-36 animate-pulse rounded-lg bg-surface-container" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-xl bg-surface-container-low" />
          ))}
        </div>
        <div className="flex flex-col gap-xl">
          <div>
            <div className="mb-md h-6 w-40 animate-pulse rounded-lg bg-surface-container" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="mb-sm h-20 animate-pulse rounded-xl bg-surface-container-low"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Milestone CTA */}
      <div className="h-28 animate-pulse rounded-xl bg-surface-container" />
    </div>
  );
}
