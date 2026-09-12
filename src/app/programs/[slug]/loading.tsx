export default function ProgramDetailLoading() {
  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-3xl lg:px-lg">
      <div className="h-4 w-32 animate-pulse rounded bg-surface-container" />
      <div className="mt-md h-12 w-3/4 max-w-2xl animate-pulse rounded-lg bg-surface-container" />
      <div className="mt-md h-6 w-1/2 max-w-xl animate-pulse rounded-lg bg-surface-container" />
      <div className="mt-2xl grid grid-cols-2 gap-xl md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-container" />
        ))}
      </div>
      <div className="mt-2xl flex flex-col gap-md">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
