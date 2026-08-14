"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction } from "@/app/(auth)/actions";
import { initialAuthState } from "@/app/(auth)/auth-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useT } from "@/components/locale-provider";

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t("common.loading") : t("auth.signIn")}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const t = useT();
  const [state, formAction] = useActionState(signInAction, initialAuthState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

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

      <Field label={t("auth.password")} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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

      <SubmitButton />
    </form>
  );
}
