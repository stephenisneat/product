export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <div className="h-4 w-2/3 max-w-md animate-pulse rounded bg-muted/50" />
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/30" />
        <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/25" />
        <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/20" />
      </div>
    </div>
  );
}
