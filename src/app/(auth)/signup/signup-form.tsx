"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUpAction } from "@/app/(auth)/actions";
import { initialAuthState } from "@/app/(auth)/auth-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { t } from "@/lib/i18n";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t("common.loading") : t("auth.signUp")}
    </Button>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signUpAction, initialAuthState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <Field label={t("auth.fullName")} htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>

      <Field label={t("auth.email")} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@university.ac.id"
        />
      </Field>

      <Field
        label={t("auth.university")}
        htmlFor="university"
        hint="Optional — helps us tailor competition recommendations."
      >
        <Input
          id="university"
          name="university"
          autoComplete="organization"
          placeholder="Universitas Indonesia"
        />
      </Field>

      <Field
        label={t("auth.password")}
        htmlFor="password"
        hint="At least 8 characters."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[12px] bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p
          role="status"
          className="rounded-[12px] bg-violet-100 px-3 py-2 text-sm text-secondary-dark"
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
