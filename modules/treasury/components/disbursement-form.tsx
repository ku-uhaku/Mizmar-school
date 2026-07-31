"use client";

import { BanknoteArrowUpIcon } from "lucide-react";
import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { FormActions, FormGrid, FormSection } from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/i18n/format";
import { recordDisbursementAction } from "@/modules/treasury/actions";
import { TENDER_METHODS, type TenderMethod } from "@/modules/treasury/enums";
import type { ExpenseCategoryOption } from "@/modules/treasury/queries";

/**
 * Décaissement: money out.
 *
 * The beneficiary is free text on purpose — a school pays landlords, hauliers
 * and casual staff who have no row anywhere in this database, and forcing them
 * through a table would mean inventing one for every one-off payment.
 */
export function DisbursementForm({
  categories,
  hasOpenSession,
}: {
  categories: ExpenseCategoryOption[];
  hasOpenSession: boolean;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(
    recordDisbursementAction,
    IDLE,
  );
  const [method, setMethod] = React.useState<TenderMethod>("CASH");
  const formRef = React.useRef<HTMLFormElement>(null);

  useActionFeedback(state, {
    onSuccess: () => {
      formRef.current?.reset();
      setMethod("CASH");
    },
  });

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className="grid max-w-3xl gap-5">
      <FormSection title={t.treasury.decaissement} description={t.treasury.decaissementSubtitle}>
        <FormGrid cols={2}>
          <FormField
            name="beneficiaryName"
            label={t.treasury.beneficiaryName}
            hint={t.treasury.beneficiaryHint}
            error={errors.beneficiaryName}
            required
          >
            <Input
              {...controlProps(
                "beneficiaryName",
                errors.beneficiaryName,
                t.treasury.beneficiaryHint,
              )}
              required
            />
          </FormField>

          <FormField
            name="expenseCategoryId"
            label={t.treasury.expenseCategory}
            error={errors.expenseCategoryId}
          >
            <Select name="expenseCategoryId" defaultValue="__none__">
              <SelectTrigger id="expenseCategoryId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>

        <FormField
          name="label"
          label={t.treasury.label}
          hint={t.treasury.labelHint}
          error={errors.label}
          required
        >
          <Input
            {...controlProps("label", errors.label, t.treasury.labelHint)}
            required
          />
        </FormField>

        <FormGrid cols={3}>
          <FormField name="method" label={t.treasury.method} error={errors.method}>
            <Select
              name="method"
              value={method}
              onValueChange={(value) => setMethod(value as TenderMethod)}
            >
              <SelectTrigger id="method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TENDER_METHODS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t.treasuryOptions.methods[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            name="amount"
            label={t.treasury.amount}
            error={errors.amount}
            required
          >
            <Input
              {...controlProps("amount", errors.amount)}
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              placeholder="0.00"
              required
            />
          </FormField>

          <FormField
            name="occurredAt"
            label={t.treasury.occurredAt}
            error={errors.occurredAt}
          >
            <Input
              {...controlProps("occurredAt", errors.occurredAt)}
              type="date"
              defaultValue={toDateInputValue(new Date())}
              dir="ltr"
            />
          </FormField>
        </FormGrid>

        {method === "CHEQUE" ? (
          <FormGrid cols={2}>
            <FormField
              name="chequeNumber"
              label={t.treasury.chequeNumber}
              error={errors.chequeNumber}
              required
            >
              <Input
                {...controlProps("chequeNumber", errors.chequeNumber)}
                dir="ltr"
                required
              />
            </FormField>
            <FormField name="bankName" label={t.treasury.bankName}>
              <Input {...controlProps("bankName")} />
            </FormField>
          </FormGrid>
        ) : null}

        {method === "BANK_TRANSFER" ? (
          <FormGrid cols={2}>
            <FormField name="reference" label={t.treasury.reference}>
              <Input {...controlProps("reference")} dir="ltr" />
            </FormField>
            <FormField name="bankName" label={t.treasury.bankName}>
              <Input {...controlProps("bankName")} />
            </FormField>
          </FormGrid>
        ) : null}

        <FormField name="notes" label={t.treasury.notes}>
          <Textarea {...controlProps("notes")} rows={2} />
        </FormField>
      </FormSection>

      <FormActions
        hint={
          method === "CASH" && !hasOpenSession
            ? t.treasury.noOpenSession
            : undefined
        }
      >
        <SubmitButton size="lg" disabled={method === "CASH" && !hasOpenSession}>
          <BanknoteArrowUpIcon className="size-4" />
          {t.treasury.recordDisbursement}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
