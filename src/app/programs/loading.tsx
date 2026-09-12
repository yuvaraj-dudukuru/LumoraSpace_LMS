export default function ProgramsLoading() {
  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-3xl lg:px-lg">
      <div className="h-10 w-2/3 max-w-xl animate-pulse rounded-lg bg-surface-container" />
      <div className="mt-md h-6 w-1/2 max-w-md animate-pulse rounded-lg bg-surface-container" />
      <div className="mt-2xl grid grid-cols-1 gap-xl md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
