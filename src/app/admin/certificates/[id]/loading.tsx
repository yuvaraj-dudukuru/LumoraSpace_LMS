export default function AdminCertificateDetailLoading() {
  return (
    <div className="flex flex-col gap-xl">
      <div className="flex flex-col gap-sm">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-surface-container" />
        <div className="h-5 w-64 animate-pulse rounded bg-surface-container" />
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-surface-container-low" />
    </div>
  );
}
