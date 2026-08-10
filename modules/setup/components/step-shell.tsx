"use client";

import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * One step of the wizard, with its own on/off switch.
 *
 * ── Why a `<fieldset disabled>` and not conditional rendering ───────────────
 * A disabled control is not submitted, so a step switched off posts nothing at
 * all and the action needs no "skip" flags — skipped simply means the array
 * arrived empty. Rendering the step away instead would lose everything typed in
 * it, and a school that turns a step back on expects to find its answers where
 * it left them. The hidden inputs are *also* only rendered when the step is on,
 * because they are the half that actually carries the values.
 *
 * Every pane stays mounted for the lifetime of the form and only its visibility
 * toggles — the same reason `enrol-wizard.tsx` does it: nothing typed on an
 * earlier step is lost by moving on, and the final submit posts the whole thing
 * at once.
 */
export function StepShell({
  visible,
  title,
  description,
  enabled,
  onEnabledChange,
  blockedReason,
  id,
  children,
  hidden,
}: {
  visible: boolean;
  title: string;
  description: string;
  /** Omitted for the steps that cannot be switched off. */
  enabled?: boolean;
  onEnabledChange?: (value: boolean) => void;
  /** Set when an earlier step being off makes this one impossible. */
  blockedReason?: string;
  id: string;
  children: React.ReactNode;
  /** The hidden inputs this step posts. Rendered only when it is on. */
  hidden?: React.ReactNode;
}) {
  const t = useT();
  const skippable = onEnabledChange !== undefined;
  const on = blockedReason ? false : (enabled ?? true);

  return (
    <div className={visible ? "grid gap-5" : "hidden"}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {title}
                {skippable && !on ? (
                  <Badge variant="outline">{t.setup.stepSkipped}</Badge>
                ) : null}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>

            {skippable && !blockedReason ? (
              <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <Label htmlFor={`${id}-enabled`} className="text-sm font-normal">
                  {t.setup.configureThisStep}
                </Label>
                <Switch
                  id={`${id}-enabled`}
                  checked={on}
                  onCheckedChange={(value) => onEnabledChange?.(value === true)}
                />
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {blockedReason ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {blockedReason}
            </p>
          ) : (
            <>
              <fieldset
                disabled={!on}
                className={on ? "grid gap-5 border-0 p-0" : "grid gap-5 border-0 p-0 opacity-50"}
              >
                {children}
              </fieldset>
              {!on && skippable ? (
                <p className="text-muted-foreground mt-4 text-xs">{t.setup.skipHint}</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {on && !blockedReason ? hidden : null}
    </div>
  );
}

/** A checkbox row that carries its value in a hidden input when ticked. */
export function CheckRow({
  id,
  name,
  value,
  checked,
  onCheckedChange,
  label,
  hint,
  badges,
  className,
}: {
  id: string;
  /** Omitted when the caller renders the hidden inputs itself. */
  name?: string;
  value: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  badges?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={
        className ??
        "hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
      }
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className="mt-0.5"
      />
      <span className="grid gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm leading-snug font-medium">
          {label}
          {badges}
        </span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </span>
      {/* Radix's Checkbox is not a native input, so a ticked row carries its
          value in a hidden field — the same trick the permission matrix uses. */}
      {name && checked ? <input type="hidden" name={name} value={value} /> : null}
    </label>
  );
}
