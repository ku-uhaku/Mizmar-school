"use client";

import * as React from "react";
import { useActionState } from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDate, formatNumber, interpolate } from "@/lib/i18n/format";
import { BPS_PER_PERCENT } from "@/modules/billing/enums";
import { centimesToDirhams } from "@/modules/classes/enums";
import { updateFeeLineAction } from "@/modules/enrolment/actions";
import { FEE_LINE_STATUSES, netAmount } from "@/modules/enrolment/enums";
import type { FeeCell } from "@/modules/enrolment/queries";

/**
 * Edits one month of one charge.
 *
 * The payable figure is previewed live, using the same `netAmount` the server
 * writes with — so what the bursar reads before saving is exactly what lands in
 * the column, rather than a second implementation of the same rule.
 */
export function FeeCellDialog({
  open,
  onOpenChange,
  cell,
  discounts,
  followingCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cell: FeeCell;
  discounts: {
    id: string;
    code: string;
    name: string;
    kind: string;
    percentBps: number | null;
    amountCentimes: number | null;
  }[];
  /** Later instalments of the same charge — 0 hides the carry-forward option. */
  followingCount: number;
}) {
  const { t, locale } = useI18n();
  const [state, formAction] = useActionState(updateFeeLineAction, IDLE);
  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  const errors = state.fieldErrors ?? {};

  // Initialised from the cell, not synchronised with it: the caller remounts
  // this component per cell (`key` in FeeGrid), so pointing the dialog at a
  // different month starts from that month's figures rather than needing an
  // effect to copy them across.
  const [base, setBase] = React.useState(
    String(centimesToDirhams(cell.baseAmountCentimes)),
  );
  const [percent, setPercent] = React.useState(
    String(cell.discountBps / BPS_PER_PERCENT),
  );
  const [flat, setFlat] = React.useState(
    String(centimesToDirhams(cell.discountCentimes)),
  );

  const preview = netAmount(
    Math.round((Number(base) || 0) * 100),
    Math.round((Number(percent) || 0) * BPS_PER_PERCENT),
    Math.round((Number(flat) || 0) * 100),
  );

  /**
   * Picking one of the year's declared reductions fills the numbers in. It is a
   * shortcut, not a binding: the bursar may then override either figure, which
   * is why the amounts are stored on the line rather than looked up through the
   * reduction.
   */
  function applyDiscount(discountId: string) {
    const discount = discounts.find((entry) => entry.id === discountId);
    if (!discount) {
      setPercent("0");
      setFlat("0");
      return;
    }
    if (discount.kind === "PERCENTAGE") {
      setPercent(String((discount.percentBps ?? 0) / BPS_PER_PERCENT));
      setFlat("0");
    } else {
      setPercent("0");
      setFlat(String(centimesToDirhams(discount.amountCentimes ?? 0)));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.enrolment.editFee}</DialogTitle>
          <DialogDescription>
            {interpolate(t.enrolment.instalment, { index: cell.periodIndex })} ·{" "}
            {interpolate(t.enrolment.dueOn, {
              date: formatDate(cell.dueDate, locale),
            })}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} key={cell.id}>
          <input type="hidden" name="id" value={cell.id} />

          <div className="grid gap-5">
            <FormField
              name="baseAmount"
              label={t.enrolment.baseAmount}
              error={errors.baseAmount}
              required
            >
              <Input
                {...controlProps("baseAmount", errors.baseAmount)}
                type="number"
                min={0}
                step="0.01"
                value={base}
                onChange={(event) => setBase(event.target.value)}
                dir="ltr"
                required
              />
            </FormField>

            <FormField
              name="discountId"
              label={t.enrolment.discountRule}
              hint={t.enrolment.discountRuleHint}
              error={errors.discountId}
            >
              <Select
                name="discountId"
                defaultValue={cell.discountId ?? "__none__"}
                onValueChange={applyDiscount}
              >
                <SelectTrigger id="discountId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.common.none}</SelectItem>
                  {discounts.map((discount) => (
                    <SelectItem key={discount.id} value={discount.id}>
                      {discount.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                name="discountPercent"
                label={t.enrolment.discountPercent}
                error={errors.discountPercent}
              >
                <Input
                  {...controlProps("discountPercent", errors.discountPercent)}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                  dir="ltr"
                />
              </FormField>

              <FormField
                name="discountAmount"
                label={t.enrolment.discountAmount}
                error={errors.discountAmount}
              >
                <Input
                  {...controlProps("discountAmount", errors.discountAmount)}
                  type="number"
                  min={0}
                  step="0.01"
                  value={flat}
                  onChange={(event) => setFlat(event.target.value)}
                  dir="ltr"
                />
              </FormField>
            </div>

            <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-4 py-3">
              <span className="text-muted-foreground text-sm">
                {t.enrolment.netAmount}
              </span>
              <span className="text-lg font-semibold tabular-nums" dir="ltr">
                {formatNumber(centimesToDirhams(preview), locale)} MAD
              </span>
            </div>

            {/* Offered only when there is something to carry it to — a box that
                would do nothing is a box that teaches people to ignore boxes. */}
            {followingCount > 0 ? (
              <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  name="applyToFollowing"
                  className="mt-0.5"
                  defaultChecked={false}
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">
                    {t.enrolment.applyToFollowing}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {interpolate(t.enrolment.applyToFollowingHint, {
                      count: followingCount,
                    })}
                  </span>
                </span>
              </label>
            ) : null}

            <FormField
              name="status"
              label={t.enrolment.feeStatus}
              error={errors.status}
            >
              <Select name="status" defaultValue={cell.status}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_LINE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t.enrolmentOptions.lineStatuses[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              name="notes"
              label={t.enrolment.notes}
              error={errors.notes}
            >
              <Textarea
                {...controlProps("notes", errors.notes)}
                defaultValue={cell.notes ?? ""}
                rows={2}
              />
            </FormField>
          </div>

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.common.cancel}
            </Button>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
