import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/i18n-server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getT();

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      {/* Brand panel. Hidden below lg — on a 390px phone this would be a full
          screen of decoration between the user and the form. */}
      <aside className="hidden bg-primary-dark px-12 py-16 lg:flex lg:w-[42%] lg:flex-col lg:justify-between">
        <Link href="/" className="text-xl font-extrabold text-white">
          {t("app.name")}
        </Link>

        <div>
          <p className="display-lg max-w-md text-white">{t("app.tagline")}</p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-violet-200">
            Structured tracks, winning references, and rubric-aligned diagnostics
            for your proposal — version after version.
          </p>
        </div>

        <p className="text-xs text-violet-200/70">
          {t("landing.footer")}
        </p>
      </aside>

      <main className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        {/* Upper right of the form panel, clear of the brand panel on desktop. */}
        <div className="absolute right-5 top-5 sm:right-8 sm:top-6">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 inline-block text-lg font-extrabold text-primary lg:hidden"
          >
            {t("app.name")}
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
