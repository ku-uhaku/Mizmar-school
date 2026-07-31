"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  BanknoteIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ReceiptTextIcon,
} from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatAmount, formatMonth, interpolate } from "@/lib/i18n/format";
import { paySalaryAction, saveSalaryAction } from "@/modules/hr/actions";
import { SALARY_STATUSES, netSalary } from "@/modules/hr/enums";
import type { PayrollLine } from "@/modules/hr/queries";
import { Field } from "@/modules/hr/components/field";

/**
 * Stands in for "no bulletin prepared yet" in the status facet. A missing
 * payslip is not a status the table owns — the row exists because the person
 * is employed — but "who has not been done" is the question this screen is
 * opened to answer, so it has to be filterable.
 */
const NOT_PREPARED = "__none__";

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

  const columns = React.useMemo<ColumnDef<PayrollLine, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.staffName} ${row.staffCode}`,
        header: t.hr.employee,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.staffName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.staffCode}
              {row.original.unjustifiedDays > 0
                ? ` · ${row.original.unjustifiedDays} ${t.hr.unjustifiedAbsences}`
                : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "grossCentimes",
        header: t.hr.gross,
        meta: { className: "text-end hidden @2xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatAmount(row.original.grossCentimes, locale)}
          </span>
        ),
      },
      {
        id: "deductions",
        accessorFn: (row) => row.grossCentimes - row.netCentimes,
        header: t.hr.deductions,
        meta: { className: "text-end hidden @2xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatAmount(
              row.original.grossCentimes - row.original.netCentimes,
              locale,
            )}
          </span>
        ),
      },
      {
        accessorKey: "netCentimes",
        header: t.hr.net,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatAmount(row.original.netCentimes, locale)}
          </span>
        ),
      },
      {
        id: "status",
        // An empty id means the query found no bulletin for this month — see
        // the note on NOT_PREPARED.
        accessorFn: (row) => (row.id === "" ? NOT_PREPARED : row.status),
        header: t.hr.payslipStatus,
        cell: ({ row }) =>
          row.original.id === "" ? (
            <Badge variant="outline">{t.hr.noPayslip}</Badge>
          ) : (
            <Badge
              variant={row.original.status === "PAID" ? "secondary" : "outline"}
            >
              {
                t.hrOptions.salaryStatuses[
                  row.original.status as keyof typeof t.hrOptions.salaryStatuses
                ]
              }
            </Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const line = row.original;
          const prepared = line.id !== "";
          const payable =
            canDisburse &&
            prepared &&
            line.status !== "PAID" &&
            line.status !== "CANCELLED";

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.common.openMenu}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={line.status === "PAID"}
                    onSelect={() => setEditing(line)}
                  >
                    <PencilIcon />
                    {t.common.edit}
                  </DropdownMenuItem>
                  {payable ? (
                    <DropdownMenuItem onSelect={() => setPaying(line)}>
                      <BanknoteIcon />
                      {t.hr.pay}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, locale, canDisburse],
  );

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "status",
        label: t.hr.payslipStatus,
        options: [
          { value: NOT_PREPARED, label: t.hr.noPayslip },
          ...SALARY_STATUSES.map((status) => ({
            value: status,
            label: t.hrOptions.salaryStatuses[status],
          })),
        ],
      },
    ],
    [t],
  );

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

      <DataTable
        columns={columns}
        data={lines}
        facets={facets}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={<ReceiptTextIcon className="size-5" />}
            title={t.hr.noStaff}
          />
        }
      />

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
