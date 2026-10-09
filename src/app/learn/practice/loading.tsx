export default function PracticeLoading() {
  return (
    <div className="flex flex-col gap-xl pb-2xl">
      <div>
        <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-container" />
        <div className="mt-sm h-5 w-2/3 max-w-lg animate-pulse rounded-lg bg-surface-container" />
      </div>
      <div className="h-36 animate-pulse rounded-xl bg-surface-container-low" />
      <div className="h-2 w-full animate-pulse rounded-full bg-surface-container" />
      <div className="flex flex-col gap-md">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container-low" />
        ))}
      </div>
    </div>
  );
}
