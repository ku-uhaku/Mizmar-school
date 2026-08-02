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
import {
  paySupplierAction,
  payStaffDirectAction,
} from "@/modules/treasury/actions";
import { TENDER_METHODS, type TenderMethod } from "@/modules/treasury/enums";
import type { SupplierOption } from "@/modules/treasury/queries";

/**
 * The simple way to pay somebody: pick who, type the amount, done.
 *
 * ── Why this exists beside the décaissement form ────────────────────────────
 * That form asks twelve questions because it has to cope with paying anybody
 * for anything, and three of them are free text. A manager settling the Lydec
 * bill or buying a box of pens is not doing anything that open-ended — the
 * beneficiary, the rubrique and the label all follow from *who was picked* — so
 * this asks four questions and derives the rest server-side. The ledger entry
 * is identical; only the number of decisions changes.
 *
 * One component for all three screens rather than three near-copies: they
 * differ in which picker leads and whether a month is asked for, and two
 * screens that drifted apart on how a payment is recorded would be exactly the
 * bug this is meant to remove.
 */
export function QuickSpendForm({
  mode,
  suppliers,
  staffOptions,
  categories,
  hasOpenSession,
}: {
  /**
   *   BILL      a supplier billed for a month — utilities, rent, a contract
   *   PURCHASE  a supplier bought from on a day — the papeterie, a computer
   *   STAFF     a member of staff paid something that is not a bulletin
   */
  mode: "BILL" | "PURCHASE" | "STAFF";
  suppliers: SupplierOption[];
  staffOptions: { id: string; label: string }[];
  /** Only asked for on STAFF, where nothing else can say what it was for. */
  categories: { id: string; label: string }[];
  hasOpenSession: boolean;
}) {
  const t = useT();
  const action = mode === "STAFF" ? payStaffDirectAction : paySupplierAction;
  const [state, formAction] = React.useActionState(action, IDLE);
  const formRef = React.useRef<HTMLFormElement>(null);

  useActionFeedback(state, {
    onSuccess: () => formRef.current?.reset(),
  });

  const [method, setMethod] = React.useState<TenderMethod>("CASH");
  const [supplierId, setSupplierId] = React.useState(suppliers[0]?.id ?? "");
  const errors = state.fieldErrors ?? {};

  const chosen = suppliers.find((supplier) => supplier.id === supplierId);

  // This month, which is what a bill being settled almost always covers.
  const thisMonth = new Date().toISOString().slice(0, 7);

  if (mode !== "STAFF" && suppliers.length === 0) {
    return (
      <p className="text-warning py-8 text-center text-sm text-pretty">
        {t.treasury.noSuppliers}
      </p>
    );
  }

  return (
    <form action={formAction} ref={formRef}>
      <input type="hidden" name="method" value={method} />

      <FormSection
        title={
          mode === "STAFF" ? t.treasury.staffPayments : t.treasury.supplier
        }
      >
        <FormGrid>
          {mode === "STAFF" ? (
            <>
              <FormField
                name="staffId"
                label={t.treasury.beneficiaryStaff}
                required
              >
                <Select name="staffId" defaultValue={staffOptions[0]?.id}>
                  <SelectTrigger id="staffId" className="w-full">
                    <SelectValue placeholder={t.treasury.beneficiaryStaff} />
                  </SelectTrigger>
                  <SelectContent>
                    {staffOptions.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </>
          ) : (
            <>
              <FormField name="supplierId" label={t.treasury.supplier} required>
                <Select
                  name="supplierId"
                  value={supplierId}
                  onValueChange={setSupplierId}
                >
                  <SelectTrigger id="supplierId" className="w-full">
                    <SelectValue placeholder={t.treasury.supplier} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {/* A bill covers a month; a purchase happens on a day. */}
              {mode === "BILL" ? (
                <FormField name="period" label={t.treasury.billPeriod}>
                  <Input
                    id="period"
                    name="period"
                    type="month"
                    dir="ltr"
                    defaultValue={thisMonth}
                  />
                </FormField>
              ) : null}
            </>
          )}
        </FormGrid>

        {/* The contract number, so a facture can be checked against the file
          without anybody going to fetch it. Read-only: it belongs to the
          supplier's row, not to this payment. */}
        {chosen?.accountRef ? (
          <p className="text-muted-foreground text-xs">
            {t.treasury.accountRef} · <span dir="ltr">{chosen.accountRef}</span>
          </p>
        ) : null}
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
