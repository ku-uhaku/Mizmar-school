"use client";

import * as React from "react";
import { toast } from "sonner";

import { useT } from "@/components/providers/i18n-provider";
import { Label } from "@/components/ui/label";

/** Label + control + error. Local to this module’s dialogs, as in transport. */
export function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>
        {label}
        {required ? (
          <span aria-hidden className="text-destructive">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shared by this module’s screens, which all render the same toast handling. */
export function useToastedTransition() {
  const t = useT();
  const [isPending, startTransition] = React.useTransition();

  function run(action: () => Promise<{ status: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") toast.success(result.message ?? "");
      else toast.error(result.message ?? t.errors.unexpected);
    });
  }

  return { isPending, run };
}
