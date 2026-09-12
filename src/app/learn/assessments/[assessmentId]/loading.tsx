export default function AssessmentOverviewLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-xl py-3xl text-center">
      <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-surface-container" />

      <div className="grid w-full grid-cols-1 gap-md sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex h-28 flex-col items-center justify-center gap-xs rounded-xl bg-surface-container-low p-lg">
            <div className="h-6 w-6 animate-pulse rounded-full bg-surface-container" />
            <div className="h-3 w-16 animate-pulse rounded bg-surface-container" />
            <div className="h-5 w-12 animate-pulse rounded bg-surface-container" />
          </div>
        ))}
      </div>

      <div className="h-10 w-40 animate-pulse rounded-lg bg-surface-container" />
    </div>
  );
}
