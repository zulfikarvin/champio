import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Buttons. Min height 44px on the default size: these users are mobile-heavy and
 * that is the smallest comfortable touch target.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white shadow-[0_2px_8px_rgba(16,0,43,0.16)] hover:bg-secondary-dark hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.32)]",
        accent:
          "bg-accent text-white shadow-[0_2px_8px_rgba(123,44,191,0.24)] hover:bg-accent-light",
        outline:
          "border border-hairline bg-surface text-ink hover:border-accent hover:text-accent",
        ghost: "text-ink-muted hover:bg-violet-100 hover:text-primary",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-13 px-8 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
