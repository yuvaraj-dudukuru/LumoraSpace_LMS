export default function LearnerNotificationsLoading() {
  return (
    <div className="flex flex-col gap-xl pb-2xl">
      <div>
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-container" />
        <div className="mt-sm h-5 w-2/3 max-w-lg animate-pulse rounded-lg bg-surface-container" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-xl bg-surface-container-low" />
      ))}
    </div>
  );
}
