"use client";

import { ReceiptTextIcon } from "lucide-react";
import * as React from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, formatMonth, interpolate } from "@/lib/i18n/format";
import { paySalaryAction, saveSalaryAction } from "@/modules/hr/actions";
import { SALARY_STATUSES, netSalary } from "@/modules/hr/enums";
import type { PayrollLine } from "@/modules/hr/queries";
import { Field } from "@/modules/hr/components/field";

/**
 * La paie: one month, a line per employee, prepared and then paid.
 *
 * The net is previewed with `netSalary` — the very function the action posts it
 * with — so the figure the bursar reads before saving is the figure that lands
 * on the document. See the note at the top of enums.ts.
 */
export function PayrollList({
  lines,
  period,
  expenseCategories,
  hasOpenSession,
  canDisburse,
}: {
  lines: PayrollLine[];
  period: { year: number; month: number };
  expenseCategories: { id: string; name: string }[];
  hasOpenSession: boolean;
  canDisburse: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<PayrollLine | null>(null);
  const [paying, setPaying] = React.useState<PayrollLine | null>(null);

  const total = lines.reduce((sum, line) => sum + line.netCentimes, 0);

  function shiftMonth(delta: number) {
    const date = new Date(period.year, period.month - 1 + delta, 1);
    window.location.search = `?year=${date.getFullYear()}&month=${date.getMonth() + 1}`;
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => shiftMonth(-1)}>
            {t.common.previous}
          </Button>
          <span className="font-medium">
            {formatMonth(period.year, period.month, locale)}
          </span>
          <Button size="sm" variant="outline" onClick={() => shiftMonth(1)}>
            {t.common.next}
          </Button>
        </div>
        <p className="text-sm">
          {t.hr.payrollTotal}:{" "}
          <span className="font-semibold tabular-nums">
            {formatAmount(total, locale)}
          </span>
        </p>
      </div>

      {lines.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<ReceiptTextIcon className="size-5" />}
              title={t.hr.noStaff}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.hr.employee}</TableHead>
                    <TableHead className="text-end">{t.hr.gross}</TableHead>
                    <TableHead className="text-end">{t.hr.deductions}</TableHead>
                    <TableHead className="text-end">{t.hr.net}</TableHead>
                    <TableHead>{t.hr.payslipStatus}</TableHead>
                    <TableHead className="text-end">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => {
                    const deducted = line.grossCentimes - line.netCentimes;
                    const prepared = line.id !== "";

                    return (
                      <TableRow key={line.staffId}>
                        <TableCell>
                          <span className="font-medium">{line.staffName}</span>
                          <span className="text-muted-foreground block text-xs">
                            {line.staffCode}
                            {line.unjustifiedDays > 0
                              ? ` · ${line.unjustifiedDays} ${t.hr.unjustifiedAbsences}`
                              : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatAmount(line.grossCentimes, locale)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatAmount(deducted, locale)}
                        </TableCell>
                        <TableCell className="text-end font-medium tabular-nums">
                          {formatAmount(line.netCentimes, locale)}
                        </TableCell>
                        <TableCell>
                          {prepared ? (
                            <Badge
                              variant={
                                line.status === "PAID" ? "secondary" : "outline"
                              }
                            >
                              {
                                t.hrOptions.salaryStatuses[
                                  line.status as keyof typeof t.hrOptions.salaryStatuses
                                ]
                              }
                            </Badge>
                          ) : (
                            <Badge variant="outline">{t.hr.noPayslip}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(line)}
                            disabled={line.status === "PAID"}
                          >
                            {t.common.edit}
                          </Button>
                          {canDisburse &&
                          prepared &&
                          line.status !== "PAID" &&
                          line.status !== "CANCELLED" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPaying(line)}
                            >
                              {t.hr.pay}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {editing ? (
        <PayslipDialog line={editing} onClose={() => setEditing(null)} />
      ) : null}

      {paying ? (
        <PayoutDialog
          line={paying}
          expenseCategories={expenseCategories}
          hasOpenSession={hasOpenSession}
          onClose={() => setPaying(null)}
        />
      ) : null}
    </div>
  );
}

const DIRHAMS = (centimes: number) => (centimes / 100).toFixed(2);

function PayslipDialog({
  line,
  onClose,
}: {
  line: PayrollLine;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction] = React.useActionState(saveSalaryAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  // Kept in state purely so the net updates as the bursar types. The server
  // recomputes it from the same helper, so this can never be authoritative.
  const [amounts, setAmounts] = React.useState({
    base: DIRHAMS(line.baseCentimes),
    allowance: DIRHAMS(line.allowanceCentimes),
    overtime: DIRHAMS(line.overtimeCentimes),
    bonus: DIRHAMS(line.bonusCentimes),
    absence: DIRHAMS(line.absenceCentimes),
    advance: DIRHAMS(line.advanceCentimes),
    social: DIRHAMS(line.socialCentimes),
    tax: DIRHAMS(line.taxCentimes),
    otherDeduction: DIRHAMS(line.otherDeductionCentimes),
  });

  const centimes = (value: string) => Math.round((Number(value) || 0) * 100);

  const preview = netSalary(
    {
      baseCentimes: centimes(amounts.base),
      allowanceCentimes: centimes(amounts.allowance),
      overtimeCentimes: centimes(amounts.overtime),
      bonusCentimes: centimes(amounts.bonus),
    },
    {
      absenceCentimes: centimes(amounts.absence),
      advanceCentimes: centimes(amounts.advance),
      socialCentimes: centimes(amounts.social),
      taxCentimes: centimes(amounts.tax),
      otherDeductionCentimes: centimes(amounts.otherDeduction),
    },
  );

  const money = (
    key: keyof typeof amounts,
    label: string,
    error?: string,
  ) => (
    <Field label={label} name={key} error={error}>
      <Input
        id={key}
        name={key}
        type="number"
        step="0.01"
        min="0"
        dir="ltr"
        value={amounts[key]}
        onChange={(event) =>
          setAmounts((current) => ({ ...current, [key]: event.target.value }))
        }
      />
    </Field>
  );

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.hr.editPayslip}</DialogTitle>
            <DialogDescription>
              {line.staffName} ·{" "}
              {formatMonth(line.periodYear, line.periodMonth, locale)}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="staffId" value={line.staffId} />
          <input type="hidden" name="periodYear" value={line.periodYear} />
          <input type="hidden" name="periodMonth" value={line.periodMonth} />

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">{t.hr.gains}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {money("base", t.hr.base, errors.base)}
              {money("allowance", t.hr.allowance)}
              {money("overtime", t.hr.overtime)}
              {money("bonus", t.hr.bonus)}
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">
              {t.hr.deductions}
            </legend>
            {/* The month's unjustified days sit beside the retenue box on
                purpose — the figure is a decision, never a rule this code
                applies. See SalaryPayment.absenceCentimes. */}
            <p className="text-muted-foreground text-xs">
              {interpolate(t.hr.absenceDeductionHint, {
                days: line.unjustifiedDays,
                rate: formatAmount(line.dailyRateCentimes, locale),
              })}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {money("absence", t.hr.absenceDeduction)}
              {money("advance", t.hr.advance)}
              {money("social", t.hr.social)}
              {money("tax", t.hr.tax)}
              {money("otherDeduction", t.hr.otherDeduction)}
              <Field label={t.hr.deductionLabel} name="deductionLabel">
                <Input
                  id="deductionLabel"
                  name="deductionLabel"
                  defaultValue={line.deductionLabel ?? ""}
                />
              </Field>
            </div>
          </fieldset>

          <div className="bg-muted grid gap-1 rounded-md p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t.hr.net}</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatAmount(preview, locale)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">{t.hr.netHint}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.hr.payslipStatus} name="status">
              <Select
                name="status"
                defaultValue={line.status === "PAID" ? "APPROVED" : line.status}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_STATUSES.filter((status) => status !== "PAID").map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        {t.hrOptions.salaryStatuses[status]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.hr.notes} name="notes">
              <Textarea id="notes" name="notes" rows={2} defaultValue={line.notes ?? ""} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayoutDialog({
  line,
  expenseCategories,
  hasOpenSession,
  onClose,
}: {
  line: PayrollLine;
  expenseCategories: { id: string; name: string }[];
  hasOpenSession: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction] = React.useActionState(paySalaryAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};
  const [method, setMethod] = React.useState("BANK_TRANSFER");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.hr.paySalary}</DialogTitle>
            <DialogDescription>
              {interpolate(t.hr.paySalaryBody, {
                name: line.staffName,
                amount: formatAmount(line.netCentimes, locale),
              })}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="salaryId" value={line.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.hr.method} name="method" error={errors.method}>
              <Select name="method" value={method} onValueChange={setMethod}>
                <SelectTrigger id="method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">
                    {t.hrOptions.payoutMethods.BANK_TRANSFER}
                  </SelectItem>
                  <SelectItem value="CHEQUE">
                    {t.hrOptions.payoutMethods.CHEQUE}
                  </SelectItem>
                  <SelectItem value="CASH" disabled={!hasOpenSession}>
                    {t.hrOptions.payoutMethods.CASH}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.hr.paidOn} name="paidOn" error={errors.paidOn}>
              <Input
                id="paidOn"
                name="paidOn"
                type="date"
                dir="ltr"
                defaultValue={today}
              />
            </Field>
          </div>

          {method === "CASH" && !hasOpenSession ? (
            <p className="text-destructive text-xs">{t.hr.noOpenSession}</p>
          ) : null}

          {method === "CHEQUE" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.hr.chequeNumber} name="chequeNumber">
                <Input id="chequeNumber" name="chequeNumber" dir="ltr" />
              </Field>
              <Field label={t.hr.bankName} name="bankName">
                <Input id="bankName" name="bankName" />
              </Field>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.hr.expenseCategory} name="expenseCategoryId">
              <Select name="expenseCategoryId" defaultValue="__none__">
                <SelectTrigger id="expenseCategoryId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.common.none}</SelectItem>
                  {expenseCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.hr.reference} name="reference">
              <Input id="reference" name="reference" dir="ltr" />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton>{t.hr.pay}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
