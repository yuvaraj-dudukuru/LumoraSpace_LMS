export default function AdminCertificatesLoading() {
  return (
    <div className="flex flex-col gap-xl">
      <div className="flex flex-col gap-sm">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-surface-container" />
      </div>
      <div className="flex gap-sm">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-surface-container" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-surface-container-low" />
    </div>
  );
}
