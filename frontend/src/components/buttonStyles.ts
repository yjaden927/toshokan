import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:brightness-110 active:brightness-95",
  secondary: "border border-line bg-surface text-ink hover:bg-sunken",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95",
};

/** Shared with links that look like buttons, so both stay in step. */
export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return clsx(
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition duration-200 ease-smooth disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    className,
  );
}
