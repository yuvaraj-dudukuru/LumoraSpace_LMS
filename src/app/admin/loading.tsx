export default function AdminDashboardLoading() {
  return (
    <div className="flex flex-col gap-2xl">
      <div className="flex flex-col gap-sm">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-surface-container" />
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-container-low" />
        ))}
      </div>

      <div className="flex flex-wrap gap-md">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-40 animate-pulse rounded-full bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
