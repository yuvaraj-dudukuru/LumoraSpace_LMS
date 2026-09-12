export default function CertificatesLoading() {
  return (
    <div className="flex flex-col gap-xl">
      <div className="flex flex-col gap-sm">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-surface-container" />
      </div>
      <ul className="flex flex-col gap-md">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex items-center gap-lg rounded-xl bg-surface-container-low p-lg">
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-surface-container" />
            <div className="flex min-w-0 flex-1 flex-col gap-xs">
              <div className="h-4 w-32 animate-pulse rounded bg-surface-container" />
              <div className="h-5 w-48 animate-pulse rounded bg-surface-container" />
              <div className="h-4 w-24 animate-pulse rounded bg-surface-container" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
