export default function MentorSubmissionsQueueLoading() {
  return (
    <div className="flex flex-col gap-xl">
      <div className="flex flex-col gap-sm">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-surface-container" />
      </div>
      <div className="flex gap-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-surface-container" />
        ))}
      </div>
      <div className="flex flex-col gap-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container-low" />
        ))}
      </div>
    </div>
  );
}
