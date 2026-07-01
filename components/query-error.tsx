"use client";

// Shared "stuck loading forever" fix: react-query's `data` stays undefined
// both while a request is still in flight AND after it has failed and
// given up retrying, so `if (!data) return <p>Loading...</p>` can't tell
// the two apart — a persistent server error looks identical to "still
// loading," with no error message and no way to retry. This renders the
// right one of three states explicitly.
export function QueryError({
  error,
  onRetry,
  label = "data",
}: {
  error: unknown;
  onRetry: () => void;
  label?: string;
}) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="text-sm space-y-2">
      <p className="text-red-400">Couldn&apos;t load {label}: {message}</p>
      <button onClick={onRetry} className="rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5">
        Retry
      </button>
    </div>
  );
}
