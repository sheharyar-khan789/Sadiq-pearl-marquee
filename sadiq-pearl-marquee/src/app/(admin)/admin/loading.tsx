export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="h-9 w-56 rounded-xl bg-surface-mid motion-safe:animate-pulse" />
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface-mid motion-safe:animate-pulse" />
        ))}
      </div>
      <div aria-hidden="true" className="h-64 rounded-2xl bg-surface-mid motion-safe:animate-pulse" />
    </div>
  );
}
