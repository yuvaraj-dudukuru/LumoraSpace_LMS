export default function ProgramCurriculumLoading() {
  return (
    <div className="flex flex-col gap-lg">
      <div className="h-10 w-2/3 max-w-lg animate-pulse rounded-lg bg-surface-container" />
      <div className="h-2 w-full animate-pulse rounded-full bg-surface-container" />
      <div className="mt-md flex flex-col gap-md">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
