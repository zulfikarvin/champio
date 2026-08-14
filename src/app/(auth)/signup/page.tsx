import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/app/(auth)/signup/signup-form";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const t = await getT();
  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === "string" ? rawNext : "/dashboard";

  return (
    <>
      <h1 className="display-lg mb-1 text-primary">{t("auth.startCompeting")}</h1>
      <p className="mb-8 text-sm text-ink-muted">{t("auth.startCompetingSub")}</p>

      <SignupForm next={next} />

      <p className="mt-6 text-sm text-ink-muted">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </>
  );
}
