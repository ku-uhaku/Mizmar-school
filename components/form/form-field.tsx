"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + hint + error, wired to the `fieldErrors` map that Server
 * Actions return. Keeping this in one place is what keeps every form in the app
 * reporting validation the same way.
 */
export function FormField({
  name,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    /*
      `min-w-0` is load-bearing, not tidying.

      A grid or flex child defaults to `min-width: auto`, which means it refuses
      to shrink below its own content. A field holding a long value — the level
      picker on a pupil's file, whose options read "1ère année du baccalauréat ·
      Sciences mathématiques" — therefore pushed its whole column past the `1fr`
      it was given, and the columns beside it were squeezed to compensate. The
      controls already know how to truncate; they were never allowed to.
    */
    <div className={cn("grid min-w-0 gap-2", className)}>
      <Label htmlFor={name} className="gap-1">
        {label}
        {required ? (
          <span aria-hidden className="text-destructive">
            *
          </span>
        ) : null}
      </Label>

      {children}

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Props every control inside a FormField needs, derived from its name/error. */
export function controlProps(name: string, error?: string, hint?: string) {
  return {
    id: name,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby":
      [hint ? `${name}-hint` : null, error ? `${name}-error` : null]
        .filter(Boolean)
        .join(" ") || undefined,
  } as const;
}
