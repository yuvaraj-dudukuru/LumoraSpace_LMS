export default function MentorLearnerDetailLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-xl">
      <div className="h-5 w-32 animate-pulse rounded bg-surface-container" />
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl lg:col-span-2">
          <div className="flex items-center gap-md">
            <div className="h-16 w-16 animate-pulse rounded-full bg-surface-container" />
            <div className="flex flex-col gap-xs">
              <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-4 w-40 animate-pulse rounded bg-surface-container" />
            </div>
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-container-low" />
          ))}
        </div>
        <div className="flex flex-col gap-lg">
          <div className="h-40 animate-pulse rounded-2xl bg-surface-container-low" />
          <div className="h-24 animate-pulse rounded-2xl bg-surface-container-low" />
        </div>
      </div>
    </div>
  );
}
