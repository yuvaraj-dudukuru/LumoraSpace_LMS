export default function AdminPaymentDetailLoading() {
  return (
    <div className="flex flex-col gap-xl">
      <div className="h-10 w-72 max-w-full animate-pulse rounded-lg bg-surface-container" />
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-3">
        <div className="flex flex-col gap-xl lg:col-span-2">
          <div className="h-48 animate-pulse rounded-2xl bg-surface-container-low" />
          <div className="h-80 animate-pulse rounded-2xl bg-surface-container-low" />
        </div>
        <div className="flex flex-col gap-xl">
          <div className="h-48 animate-pulse rounded-2xl bg-surface-container-low" />
          <div className="h-48 animate-pulse rounded-2xl bg-surface-container-low" />
        </div>
      </div>
    </div>
  );
}
