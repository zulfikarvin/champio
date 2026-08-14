import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getT();
  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === "string" ? rawNext : "/dashboard";

  return (
    <>
      <h1 className="display-lg mb-1 text-primary">{t("auth.welcomeBack")}</h1>
      <p className="mb-8 text-sm text-ink-muted">{t("auth.welcomeBackSub")}</p>

      <LoginForm next={next} />

      <p className="mt-6 text-sm text-ink-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-accent hover:underline">
          {t("auth.signUp")}
        </Link>
      </p>
    </>
  );
}
