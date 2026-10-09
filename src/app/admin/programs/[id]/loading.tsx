export default function AdminProgramDetailLoading() {
  return (
    <div className="flex flex-col gap-xl">
      <div className="h-10 w-72 max-w-full animate-pulse rounded-lg bg-surface-container" />
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-container-low" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="h-96 animate-pulse rounded-2xl bg-surface-container-low lg:col-span-2" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface-container-low" />
      </div>
    </div>
  );
}
