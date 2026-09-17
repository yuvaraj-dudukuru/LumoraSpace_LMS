export default function PracticeLoading() {
  return (
    <div className="flex flex-col gap-2xl pb-2xl">
      <div>
        <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-container" />
        <div className="mt-sm h-5 w-2/3 max-w-lg animate-pulse rounded-lg bg-surface-container" />
      </div>
      <div className="flex flex-col gap-md">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-4 w-32 animate-pulse rounded bg-surface-container" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container-low" />
        ))}
      </div>
    </div>
  );
}
