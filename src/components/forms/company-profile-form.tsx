"use client";

import { useActionState } from "react";
import { updateCompanyName } from "@/server/actions/company-profile";
import { Field, Input, FormError, Button, Card } from "@/components/ui";

type FormState = { error: string };
const initialState: FormState = { error: "" };

export function CompanyProfileForm({ defaultValues }: { defaultValues: { name: string } }) {
  const [state, formAction, isPending] = useActionState(updateCompanyName, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Company profile</p>
      <form action={formAction} className="flex max-w-sm flex-col gap-3">
        <Field label="Company name" hint="Fix a typo or rename your company — this doesn't change your URL or company code.">
          <Input name="name" defaultValue={defaultValues.name} required minLength={2} />
        </Field>
        <FormError error={state.error} />
        <Button type="submit" isPending={isPending} pendingLabel="Saving…" size="sm" className="self-start">
          Save name
        </Button>
      </form>
    </Card>
  );
}
