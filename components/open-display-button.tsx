"use client";

// Pops the projector display out into its own window, so a facilitator can
// drag it onto the projector/second screen and fullscreen it while keeping
// the console on their own laptop.
//
// The window is given a stable name, so clicking again focuses the existing
// display window instead of stacking up duplicates. The display route is
// public (token-authenticated, see app/api/display/route.ts), so the popped
// window needs no session of its own — which is the point: the projector is
// usually a machine nobody is logged in on.
export function OpenDisplayButton({
  displayToken,
  className,
  label = "Open Projector Display",
}: {
  displayToken: string;
  className?: string;
  label?: string;
}) {
  function open() {
    const url = `/display/${displayToken}`;
    const existing = window.open(url, "veiled-horizon-display", "width=1280,height=800");
    // Already-open windows keep their content; focus is what the user wants
    // on a second click. Guarded because a blocked popup returns null.
    existing?.focus();
  }

  return (
    <button
      type="button"
      onClick={open}
      className={
        className ??
        "rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-1 text-sm text-slate-200 shrink-0"
      }
    >
      {label}
    </button>
  );
}
