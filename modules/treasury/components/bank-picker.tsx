"use client";

import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { useT } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BankOption } from "@/modules/treasury/queries";

/** Blank for a Select, which cannot hold "". */
const NONE = "__none__";
/** "a bank the school has not declared" — reveals the free-text box. */
const OTHER = "__other__";

/**
 * The bank on a cheque or a virement: a picker, with a way out.
 *
 * The list is what the school actually deals with, so "Attijariwafa" is one
 * bank rather than the four spellings a free-text box produced. But a parent's
 * cheque may be drawn on any bank in the country, and a desk that cannot record
 * one until somebody opens the configuration screen is a desk that stops — so
 * "Autre" reveals the text box the column has always had.
 *
 * Both are posted: `bankId` when it is one of ours, `bankName` when it is not.
 * See the note on Cheque.bankId.
 */
export function BankPicker({
  banks,
  label,
  /** Distinguishes the two pickers on the encaissement screen's tender rows. */
  namePrefix = "",
  defaultBankId,
  defaultBankName,
}: {
  banks: BankOption[];
  label: string;
  namePrefix?: string;
  defaultBankId?: string | null;
  defaultBankName?: string | null;
}) {
  const t = useT();
  const [value, setValue] = React.useState(
    defaultBankId ?? (defaultBankName ? OTHER : NONE),
  );

  const idName = namePrefix ? `${namePrefix}BankId` : "bankId";
  const nameName = namePrefix ? `${namePrefix}BankName` : "bankName";

  return (
    <>
      <FormField name={idName} label={label}>
        <Select
          // The sentinels are stripped server-side by `optionalId`, so neither
          // reaches the column.
          name={value === OTHER ? undefined : idName}
          value={value}
          onValueChange={setValue}
        >
          <SelectTrigger id={idName} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t.common.none}</SelectItem>
            {banks.map((bank) => (
              <SelectItem key={bank.id} value={bank.id}>
                {bank.name}
              </SelectItem>
            ))}
            <SelectItem value={OTHER}>{t.treasury.otherBank}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {value === OTHER ? (
        <FormField
          name={nameName}
          label={t.treasury.bankName}
          hint={t.treasury.otherBankHint}
        >
          <Input
            {...controlProps(nameName)}
            defaultValue={defaultBankName ?? ""}
            autoFocus
          />
        </FormField>
      ) : null}
    </>
  );
}
