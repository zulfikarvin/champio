import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[12px] border border-hairline bg-surface px-4",
        // 16px text prevents iOS Safari from zooming the viewport on focus —
        // a small thing that makes mobile forms feel broken when you get it wrong.
        "text-base text-ink placeholder:text-ink-muted/60",
        "transition-colors focus:border-accent focus:outline-none",
        "disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-semibold text-ink", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
