"use client";

// Local (non-routed) view switch — replaces the old single long scroll on a
// page with named views. Selection state lives in the parent (useState), not
// in the URL.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={`inline-flex items-center gap-1.5 self-start rounded-full bg-neutral-200 p-[5px] text-sm ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={
            opt.value === value
              ? "rounded-full bg-bg px-5 py-[7px] font-bold text-text shadow-sm"
              : "rounded-full px-5 py-[7px] text-neutral-700 hover:text-text"
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
