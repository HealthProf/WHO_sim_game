import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Every action in the Organic design system is a pill — no 6px rounded-md
// buttons. `tone` picks which ramp fills it; per the handoff's contrast
// rules, any fill carrying white text must be the -700 step (or darker) of
// its ramp, never the bare --color-accent.
type Tone = "accent" | "sage" | "ghost" | "ghost-dark" | "white";

const toneClass: Record<Tone, string> = {
  accent: "bg-accent-700 text-white hover:bg-accent-600 active:bg-accent-800",
  sage: "bg-accent-2-700 text-white hover:bg-accent-2-600 active:bg-accent-2-800",
  ghost: "border-2 border-divider text-text hover:bg-surface active:bg-neutral-200",
  // For use on dark grounds (the rail, the projector) instead of fighting
  // the light `ghost` tone's border/text colors with override classes.
  "ghost-dark": "border-2 border-neutral-700 text-neutral-300 hover:bg-neutral-800 active:bg-neutral-700",
  // A solid white pill on a colored/dark ground (announcement popups) —
  // its own tone rather than overriding `accent`'s classes, for the same
  // cascade-order reason ghost-dark exists.
  white: "bg-white text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300",
};

const baseClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed";

const sizeClass = {
  md: "px-[26px] py-[11px] text-[15px]",
  sm: "px-[18px] py-[8px] text-[13px]",
};

export function PillButton({
  tone = "accent",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: keyof typeof sizeClass }) {
  return <button className={`${baseClass} ${toneClass[tone]} ${sizeClass[size]} ${className}`} {...props} />;
}

export function PillLink({
  href,
  tone = "accent",
  size = "md",
  className = "",
  children,
  ...props
}: {
  href: string;
  tone?: Tone;
  size?: keyof typeof sizeClass;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={`${baseClass} ${toneClass[tone]} ${sizeClass[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
