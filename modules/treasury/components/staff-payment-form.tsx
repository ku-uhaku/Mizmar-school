"use client";

import { BanknoteArrowUpIcon } from "lucide-react";
import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { FormActions, FormGrid, FormSection } from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
import { Combobox } from "@/components/form/combobox";
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
import { payStaffDirectAction } from "@/modules/treasury/actions";
import { TENDER_METHODS, type TenderMethod } from "@/modules/treasury/enums";

/**
 * Paying a member of staff something that is not a bulletin.
 *
 * ── Why this is not the décaissement form ───────────────────────────────────
 * That one asks twelve questions because it has to cope with paying anybody for
 * anything. Paying somebody on the payroll is not that open-ended: the
 * beneficiary is a row, so the name and the audit trail follow from the picker,
 * and what is left is the rubrique, the amount and how it left. Four questions.
 *
 * Salaries and avances are deliberately *not* here. Both are owed before they
 * are paid and both carry a document, so both have screens of their own —
 * `/hr/payroll` and `/hr/advances`. This is for the reimbursement, the
 * indemnité, the one-off; the ledger entry is identical either way, because all
 * three go through `recordDisbursement`.
 */
export function StaffPaymentForm({
  staffOptions,
  categories,
  hasOpenSession,
}: {
  staffOptions: { id: string; label: string }[];
  /** The one thing a staff payment cannot derive: what it was for. */
  categories: { id: string; label: string }[];
  hasOpenSession: boolean;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(payStaffDirectAction, IDLE);
  const formRef = React.useRef<HTMLFormElement>(null);

  useActionFeedback(state, {
    onSuccess: () => formRef.current?.reset(),
  });

  const [method, setMethod] = React.useState<TenderMethod>("CASH");
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} ref={formRef}>
      <input type="hidden" name="method" value={method} />

      <FormSection title={t.treasury.staffPayments}>
        <FormGrid>
          <FormField
            name="staffId"
            label={t.treasury.beneficiaryStaff}
            required
          >
            <Combobox
              id="staffId"
              name="staffId"
              defaultValue={staffOptions[0]?.id}
              placeholder={t.treasury.beneficiaryStaff}
              options={staffOptions.map((person) => ({
                value: person.id,
                label: person.label,
              }))}
            />
          </FormField>

          {/* The one thing a staff payment cannot derive: what it was for. */}
          <FormField
            name="categoryId"
            label={t.treasury.operationCategory}
            required
          >
            <Select name="categoryId" defaultValue={categories[0]?.id}>
              <SelectTrigger id="categoryId" className="w-full">
                <SelectValue placeholder={t.treasury.operationCategory} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>

      </FormSection>

      <FormSection title={t.treasury.amount}>
        <FormGrid>
          <FormField
            name="amount"
            label={t.treasury.amount}
            required
            error={errors.amount}
          >
            <Input
              {...controlProps("amount", errors.amount)}
              type="number"
              step="0.01"
              min="0.01"
              dir="ltr"
              autoFocus
            />
          </FormField>

          <FormField name="method" label={t.treasury.method} required>
            <Select
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

          <FormField name="occurredAt" label={t.treasury.occurredAt}>
            <Input
              id="occurredAt"
              name="occurredAt"
              type="date"
              dir="ltr"
              defaultValue={toDateInputValue(new Date())}
            />
          </FormField>

          {method === "CHEQUE" ? (
            <FormField
              name="chequeNumber"
              label={t.treasury.chequeNumber}
              required
              error={errors.chequeNumber}
            >
              <Input
                {...controlProps("chequeNumber", errors.chequeNumber)}
                dir="ltr"
              />
            </FormField>
          ) : (
            <FormField name="reference" label={t.treasury.reference}>
              <Input id="reference" name="reference" dir="ltr" />
            </FormField>
          )}
        </FormGrid>

        {/* Cash lands in a drawer, so there has to be one open — said before the
          button is pressed rather than after. */}
        {method === "CASH" && !hasOpenSession ? (
          <p className="text-warning text-xs text-pretty">
            {t.treasury.noOpenSession}
          </p>
        ) : null}

        <FormField name="notes" label={t.treasury.notes}>
          <Textarea id="notes" name="notes" rows={2} />
        </FormField>
      </FormSection>

      <FormActions>
        <SubmitButton disabled={method === "CASH" && !hasOpenSession}>
          <BanknoteArrowUpIcon />
          {t.treasury.payNow}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
