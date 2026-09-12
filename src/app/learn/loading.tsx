export default function LearnHomeLoading() {
  return (
    <div className="flex flex-col gap-3xl">
      <div className="h-10 w-2/3 max-w-lg animate-pulse rounded-lg bg-surface-container" />
      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 flex flex-col gap-gutter lg:col-span-8">
          <div className="h-56 animate-pulse rounded-2xl bg-surface-container-low" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-container-low" />
        </div>
        <div className="col-span-12 flex flex-col gap-gutter lg:col-span-4">
          <div className="h-56 animate-pulse rounded-2xl bg-surface-container" />
          <div className="h-32 animate-pulse rounded-2xl bg-surface-container" />
        </div>
      </div>
    </div>
  );
}
