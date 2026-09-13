export default function AssignmentDetailLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-xl">
      <div className="flex items-center gap-sm">
        <div className="h-4 w-28 animate-pulse rounded bg-surface-container" />
        <div className="h-4 w-4 animate-pulse rounded bg-surface-container" />
        <div className="h-4 w-24 animate-pulse rounded bg-surface-container" />
      </div>
      <div className="flex flex-col gap-md">
        <div className="h-6 w-24 animate-pulse rounded-full bg-surface-container" />
        <div className="h-9 w-96 max-w-full animate-pulse rounded-lg bg-surface-container" />
        <div className="h-4 w-64 animate-pulse rounded bg-surface-container" />
      </div>
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-sm">
              <div className="h-5 w-32 animate-pulse rounded bg-surface-container" />
              <div className="h-20 w-full animate-pulse rounded-xl bg-surface-container-low" />
            </div>
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-surface-container-low lg:col-span-1" />
      </div>
    </div>
  );
}
