export default function MyLearningLoading() {
  return (
    <div>
      <div className="h-10 w-1/3 max-w-xs animate-pulse rounded-lg bg-surface-container" />
      <div className="mt-md h-5 w-1/2 max-w-sm animate-pulse rounded-lg bg-surface-container" />
      <div className="mt-xl grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
    </div>
  );
}
