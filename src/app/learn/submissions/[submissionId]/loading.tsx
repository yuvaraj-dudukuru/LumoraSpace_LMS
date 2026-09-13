export default function SubmissionDetailLoading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-xl">
      <div className="h-5 w-36 animate-pulse rounded bg-surface-container" />
      <div className="flex items-center justify-between gap-md">
        <div className="flex flex-col gap-xs">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-container" />
          <div className="h-4 w-24 animate-pulse rounded bg-surface-container" />
        </div>
        <div className="h-7 w-28 animate-pulse rounded-full bg-surface-container" />
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-surface-container-low" />
      <div className="h-32 animate-pulse rounded-2xl bg-surface-container-low" />
      <div className="h-40 animate-pulse rounded-2xl bg-surface-container-low" />
    </div>
  );
}
