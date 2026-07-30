"use client";

import { useActionState } from "react";
import { AlertCircleIcon } from "lucide-react";

import { loginAction } from "@/modules/auth/actions";
import { useT } from "@/components/providers/i18n-provider";
import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { IDLE } from "@/lib/action-state";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useT();
  const [state, formAction] = useActionState(loginAction, IDLE);

  return (
    <form action={formAction} className="grid gap-5">
      {callbackUrl ? (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      ) : null}

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <FormField
        name="email"
        label={t.auth.email}
        error={state.fieldErrors?.email}
        required
      >
        <Input
          {...controlProps("email", state.fieldErrors?.email)}
          type="email"
          autoComplete="username"
          placeholder="nom@ecole.ma"
          dir="ltr"
          autoFocus
          required
        />
      </FormField>

      <FormField
        name="password"
        label={t.auth.password}
        error={state.fieldErrors?.password}
        required
      >
        <Input
          {...controlProps("password", state.fieldErrors?.password)}
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
        />
      </FormField>

      <SubmitButton className="w-full" pendingLabel={t.auth.signingIn}>
        {t.auth.signIn}
      </SubmitButton>
    </form>
  );
}
