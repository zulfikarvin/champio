"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/locale-actions";
import { useLocale } from "@/components/locale-provider";
import { cn } from "@/lib/cn";
import { LOCALES, LOCALE_LABELS, LOCALE_NAMES } from "@/lib/i18n";

/**
 * EN / ID toggle.
 *
 * A segmented control rather than a dropdown: with two options a select costs an
 * extra interaction and hides the alternative behind it. Both labels stay visible
 * and the active one is obvious, which also means a user who cannot read the
 * current language can still find their way out of it.
 */
export function LanguageSwitcher({
  className,
  variant = "light",
}: {
  className?: string;
  /** `dark` for placement on the deep-purple panels. */
  variant?: "light" | "dark";
}) {
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  function select(next: (typeof LOCALES)[number]) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={locale === "id" ? "Pilih bahasa" : "Select language"}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-0.5",
        variant === "dark" ? "bg-white/10" : "bg-violet-100",
        pending && "opacity-60",
        className,
      )}
    >
      <Languages
        aria-hidden
        className={cn(
          "ml-1.5 size-3.5 shrink-0",
          variant === "dark" ? "text-violet-200" : "text-secondary",
        )}
      />
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            onClick={() => select(option)}
            aria-pressed={active}
            title={LOCALE_NAMES[option]}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
              active
                ? variant === "dark"
                  ? "bg-white text-primary"
                  : "bg-white text-primary shadow-[0_1px_2px_rgba(16,0,43,0.12)]"
                : variant === "dark"
                  ? "text-violet-200 hover:text-white"
                  : "text-secondary hover:text-primary",
            )}
          >
            {LOCALE_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
