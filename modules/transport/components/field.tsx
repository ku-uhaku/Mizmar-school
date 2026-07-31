"use client";

import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { Label } from "@/components/ui/label";

/** Label + control + error, the shape every dialog field in this module uses. */
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
  const t = useT();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? (
          <span className="text-destructive ms-1" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-muted-foreground ms-1 text-xs">
            {t.common.optional}
          </span>
        )}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
