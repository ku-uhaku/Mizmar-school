"use client";

import { useActionState, useState } from "react";
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from "lucide-react";

import { loginAction } from "@/modules/auth/actions";
import { useT } from "@/components/providers/i18n-provider";
import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IDLE } from "@/lib/action-state";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useT();
  const [state, formAction] = useActionState(loginAction, IDLE);
  const [revealed, setRevealed] = useState(false);

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
        name="identifier"
        label={t.auth.identifier}
        hint={t.auth.identifierHint}
        error={state.fieldErrors?.identifier}
        required
      >
        <Input
          {...controlProps("identifier", state.fieldErrors?.identifier)}
          // `text`, not `email`: the browser would refuse a username for
          // having no `@` before the form was ever submitted.
          type="text"
          autoComplete="username"
          placeholder="k.bennis"
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
        <div className="relative">
          <Input
            {...controlProps("password", state.fieldErrors?.password)}
            type={revealed ? "text" : "password"}
            autoComplete="current-password"
            className="pe-10"
            dir="ltr"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground absolute end-1 top-1 size-8"
            aria-label={revealed ? t.auth.hidePassword : t.auth.showPassword}
            aria-pressed={revealed}
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </Button>
        </div>
      </FormField>

      <SubmitButton className="w-full" pendingLabel={t.auth.signingIn}>
        {t.auth.signIn}
      </SubmitButton>
    </form>
  );
}
