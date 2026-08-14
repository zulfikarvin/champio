"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createTeamAction } from "@/app/(app)/actions";
import { initialTeamFormState } from "@/app/(app)/team-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useT } from "@/components/locale-provider";

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t("common.loading") : t("team.create")}
    </Button>
  );
}

export function CreateTeamForm() {
  const t = useT();
  const [state, formAction] = useActionState(
    createTeamAction,
    initialTeamFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label={t("team.name")} htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          placeholder="Delta Consulting"
        />
      </Field>

      <Field label={t("auth.university")} htmlFor="team-university">
        <Input
          id="team-university"
          name="university"
          placeholder="Universitas Indonesia"
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
