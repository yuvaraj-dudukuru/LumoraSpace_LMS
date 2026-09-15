export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-2xl">
      <div className="flex flex-col gap-sm">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-surface-container" />
      </div>
      <div className="flex max-w-2xl flex-col gap-xl">
        <div className="h-72 animate-pulse rounded-2xl bg-surface-container-low" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-container-low" />
      </div>
    </div>
  );
}
