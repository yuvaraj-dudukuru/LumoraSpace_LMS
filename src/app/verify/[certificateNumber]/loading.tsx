export default function VerifyCertificateLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-outline-variant/30">
        <div className="mx-auto flex h-16 max-w-container-max items-center px-margin-mobile lg:px-lg">
          <span className="font-headline-md text-title-lg text-on-surface">LumoraSpace</span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-md">
        <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2xl text-center">
          <div className="mx-auto h-3 w-40 animate-pulse rounded bg-surface-container" />
          <div className="mx-auto mt-lg h-14 w-14 animate-pulse rounded-full bg-surface-container" />
          <div className="mx-auto mt-lg h-6 w-48 animate-pulse rounded bg-surface-container" />
          <div className="mx-auto mt-md h-8 w-56 animate-pulse rounded bg-surface-container" />
          <div className="mx-auto mt-sm h-5 w-40 animate-pulse rounded bg-surface-container" />
        </div>
      </main>
    </div>
  );
}
