export default function MentorSubmissionReviewLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-xl">
      <div className="h-5 w-40 animate-pulse rounded bg-surface-container" />
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-xs">
          <div className="h-4 w-40 animate-pulse rounded bg-surface-container" />
          <div className="h-8 w-72 animate-pulse rounded-lg bg-surface-container" />
        </div>
        <div className="h-7 w-24 animate-pulse rounded-full bg-surface-container" />
      </div>
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-lg lg:col-span-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-container-low" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-surface-container-low lg:col-span-1" />
      </div>
    </div>
  );
}
