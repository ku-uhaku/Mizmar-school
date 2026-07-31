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

const NO_STAFF = "__none__";

/**
 * Décaissement: money out.
 *
 * The beneficiary is *both* a picker and free text, and deliberately so. Paying
 * a salary or an advance should name the employee's row, so the ledger and the
 * payroll refer to the same person; but a school also pays landlords, hauliers
 * and casual staff who have no row anywhere in this database, and forcing them
 * through a table would mean inventing one for every one-off payment. Picking an
 * employee fills the name, so the ledger reads the same either way.
 */
export function DisbursementForm({
  categories,
  staffOptions,
  hasOpenSession,
}: {
  categories: ExpenseCategoryOption[];
  /**
   * The school's employees, lent by the RH module. Empty when the reader may
   * not see the staff list, which is why the name field stands on its own.
   */
  staffOptions: { id: string; label: string }[];
  hasOpenSession: boolean;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(
    recordDisbursementAction,
    IDLE,
  );
  const [method, setMethod] = React.useState<TenderMethod>("CASH");
  const [staffId, setStaffId] = React.useState(NO_STAFF);
  const [beneficiaryName, setBeneficiaryName] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);

  useActionFeedback(state, {
    onSuccess: () => {
      formRef.current?.reset();
      setMethod("CASH");
      setStaffId(NO_STAFF);
      setBeneficiaryName("");
    },
  });

  const errors = state.fieldErrors ?? {};

  /**
   * Picking an employee writes their name into the text field rather than
   * hiding it. The ledger's `beneficiaryName` is always set — see the note on
   * the column — and showing what will be written beats writing it invisibly.
   */
  function chooseStaff(value: string) {
    setStaffId(value);
    const chosen = staffOptions.find((option) => option.id === value);
    // The label carries the matricule after a "·"; the ledger wants the name.
    if (chosen) setBeneficiaryName(chosen.label.split(" · ")[0]);
  }

  return (
    <form ref={formRef} action={formAction} className="grid max-w-3xl gap-5">
      <FormSection title={t.treasury.decaissement} description={t.treasury.decaissementSubtitle}>
        {staffOptions.length > 0 ? (
          <FormField
            name="beneficiaryStaffId"
            label={t.treasury.beneficiaryStaff}
            hint={t.treasury.beneficiaryStaffHint}
          >
            <Select
              name="beneficiaryStaffId"
              value={staffId}
              onValueChange={chooseStaff}
            >
              <SelectTrigger id="beneficiaryStaffId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STAFF}>
                  {t.treasury.beneficiaryExternal}
                </SelectItem>
                {staffOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}

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
              value={beneficiaryName}
              onChange={(event) => setBeneficiaryName(event.target.value)}
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
