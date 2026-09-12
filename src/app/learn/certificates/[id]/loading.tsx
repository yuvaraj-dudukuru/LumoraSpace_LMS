export default function CertificateDetailLoading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-lg">
      <div className="h-5 w-40 animate-pulse rounded bg-surface-container" />
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-xs">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-container" />
          <div className="h-4 w-32 animate-pulse rounded bg-surface-container" />
        </div>
        <div className="h-7 w-20 animate-pulse rounded-full bg-surface-container" />
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-surface-container-low" />
    </div>
  );
}
