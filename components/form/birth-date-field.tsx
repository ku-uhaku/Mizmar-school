"use client";

import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { useI18n } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import { interpolate } from "@/lib/i18n/format";
import { ageFrom } from "@/lib/utils";

/**
 * Date of birth input with a live age readout.
 *
 * Age is never a stored column — it is derived here for display and derived
 * again on any server that needs it, so it can never drift out of date.
 */
export function BirthDateField({
  defaultValue,
  error,
  name = "birthDate",
}: {
  /** `YYYY-MM-DD`, or "" when unset. */
  defaultValue: string;
  error?: string;
  name?: string;
}) {
  const { t } = useI18n();
  const [value, setValue] = React.useState(defaultValue);

  const age = ageFrom(value);
  const hint =
    age === null
      ? t.user.birthDateHint
      : interpolate(t.user.ageYears, { count: age });

  return (
    <FormField name={name} label={t.user.birthDate} hint={hint} error={error}>
      <Input
        {...controlProps(name, error, hint)}
        type="date"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        // Nobody working in a school was born before this, and a future date is
        // always a typo — the same bounds the server enforces.
        min="1900-01-01"
        max={new Date().toISOString().slice(0, 10)}
        dir="ltr"
        autoComplete="bday"
        className="w-full"
      />
    </FormField>
  );
}
