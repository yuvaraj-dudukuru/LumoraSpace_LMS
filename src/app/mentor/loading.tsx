export default function MentorDashboardLoading() {
  return (
    <div className="flex flex-col gap-2xl">
      <div className="flex flex-col gap-sm">
        <div className="h-9 w-80 max-w-full animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-64 animate-pulse rounded bg-surface-container" />
      </div>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-container-low" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-md md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-container-low" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-sm lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container-low" />
          ))}
        </div>
        <div className="flex flex-col gap-xl">
          <div className="h-40 animate-pulse rounded-2xl bg-surface-container-low" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-container-low" />
        </div>
      </div>
    </div>
  );
}
