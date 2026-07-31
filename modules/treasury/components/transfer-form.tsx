"use client";

import { ArrowLeftRightIcon } from "lucide-react";
import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import {
  FormActions,
  FormGrid,
  FormSection,
} from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatAmount, toDateInputValue } from "@/lib/i18n/format";
import { recordTransferAction } from "@/modules/treasury/actions";
import {
  TRANSFER_TARGETS,
  type TransferTarget,
} from "@/modules/treasury/enums";
import type { RegisterRow } from "@/modules/treasury/queries";

/**
 * Transfert: cash leaving one till for another, or for the bank.
 *
 * Only open tills can be the source, because money cannot leave a drawer nobody
 * is holding — the select is filtered rather than the error being left to the
 * action, so the impossible option is never offered in the first place.
 */
export function TransferForm({ registers }: { registers: RegisterRow[] }) {
  const t = useT();
  const { currencyCode: currency } = useSettings();
  const locale = useLocale();
  const [state, formAction] = React.useActionState(recordTransferAction, IDLE);
  const formRef = React.useRef<HTMLFormElement>(null);

  const openRegisters = registers.filter(
    (register) => register.openSession !== null,
  );

  const [fromId, setFromId] = React.useState(openRegisters[0]?.id ?? "");
  const [target, setTarget] = React.useState<TransferTarget>("BANK");

  useActionFeedback(state, { onSuccess: () => formRef.current?.reset() });

  const errors = state.fieldErrors ?? {};
  const source = registers.find((register) => register.id === fromId) ?? null;
  const available = source?.openSession?.expectedCentimes ?? 0;

  if (openRegisters.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          {t.treasury.noOpenSession}
        </CardContent>
      </Card>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="grid max-w-3xl gap-5">
      <FormSection
        title={t.treasury.transfert}
        description={t.treasury.transfertSubtitle}
      >
        <FormGrid cols={2}>
          <FormField
            name="fromRegisterId"
            label={t.treasury.from}
            error={errors.fromRegisterId}
            required
          >
            <Select
              name="fromRegisterId"
              value={fromId}
              onValueChange={setFromId}
            >
              <SelectTrigger id="fromRegisterId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {openRegisters.map((register) => (
                  <SelectItem key={register.id} value={register.id}>
                    {register.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            name="target"
            label={t.treasury.target}
            error={errors.target}
          >
            <Select
              name="target"
              value={target}
              onValueChange={(value) => setTarget(value as TransferTarget)}
            >
              <SelectTrigger id="target" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSFER_TARGETS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t.treasuryOptions.transferTargets[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </FormGrid>

        {target === "REGISTER" ? (
          <FormField
            name="toRegisterId"
            label={t.treasury.to}
            error={errors.toRegisterId}
            required
          >
            <Select name="toRegisterId" defaultValue="__none__">
              <SelectTrigger id="toRegisterId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {registers
                  .filter((register) => register.id !== fromId)
                  .map((register) => (
                    <SelectItem key={register.id} value={register.id}>
                      {register.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : (
          <FormField
            name="bankAccountLabel"
            label={t.treasury.bankAccount}
            hint={t.treasury.bankAccountHint}
            error={errors.bankAccountLabel}
            required
          >
            <Input
              {...controlProps(
                "bankAccountLabel",
                errors.bankAccountLabel,
                t.treasury.bankAccountHint,
              )}
              required
            />
          </FormField>
        )}

        <FormGrid cols={3}>
          <FormField
            name="amount"
            label={t.treasury.amount}
            hint={`${t.treasury.inDrawer}: ${formatAmount(available, locale)} ${currency}`}
            error={errors.amount}
            required
          >
            <Input
              {...controlProps("amount", errors.amount)}
              type="number"
              step="0.01"
              min="0"
              max={available / 100}
              dir="ltr"
              placeholder="0.00"
              required
            />
          </FormField>

          <FormField name="reference" label={t.treasury.reference}>
            <Input {...controlProps("reference")} dir="ltr" />
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

        <FormField name="notes" label={t.treasury.notes}>
          <Textarea {...controlProps("notes")} rows={2} />
        </FormField>
      </FormSection>

      <FormActions>
        <SubmitButton size="lg">
          <ArrowLeftRightIcon className="size-4" />
          {t.treasury.recordTransfer}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
