import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/app/(auth)/signup/signup-form";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === "string" ? rawNext : "/dashboard";

  return (
    <>
      <h1 className="display-lg mb-1 text-primary">Start competing</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Create your account, then set up your team.
      </p>

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
