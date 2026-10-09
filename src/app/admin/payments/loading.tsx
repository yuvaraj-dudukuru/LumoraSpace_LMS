export default function AdminPaymentsLoading() {
  return (
    <div className="flex flex-col gap-xl">
      <div className="flex flex-col gap-sm">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-surface-container" />
      </div>
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-container-low" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-surface-container-low" />
    </div>
  );
}
