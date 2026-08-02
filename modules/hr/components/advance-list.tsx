"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  BanknoteIcon,
  CheckIcon,
  HandCoinsIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
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
import { valueOf } from "@/lib/form-values";
import { formatDate, formatMoney, interpolate } from "@/lib/i18n/format";
import {
  decideAdvanceAction,
  payAdvanceAction,
  saveAdvanceAction,
} from "@/modules/hr/actions";
import { ADVANCE_STATUSES, isAdvanceDecidable, isAdvancePayable } from "@/modules/hr/enums";
import type { AdvanceRow, StaffOption } from "@/modules/hr/queries";
import { Field, useToastedTransition } from "@/modules/hr/components/field";

/**
 * Les avances sur salaire: what was asked for, what was agreed, what has left
 * and what is still owed.
 *
 * Four columns because there are four different facts, and a school that shows
 * only the amount cannot answer the question it is actually asked — *combien
 * lui reste-t-il à rembourser ?* The outstanding figure is derived from the
 * recoveries on the payslips, so it can never drift from what the payroll
 * actually took back.
 *
 * The three actions are three different acts by three different people: raising
 * a request, agreeing to it, and letting the money out of the till. The last is
 * gated on the caisse's own permission, which is why `canDisburse` is separate
 * from `canManage`.
 */
export function AdvanceList({
  advances,
  staff,
  expenseCategories,
  hasOpenSession,
  canManage,
  canDisburse,
}: {
  advances: AdvanceRow[];
  staff: StaffOption[];
  expenseCategories: { id: string; label: string }[];
  hasOpenSession: boolean;
  canManage: boolean;
  canDisburse: boolean;
}) {
  const { t, locale } = useI18n();
  const { currencyCode: currency } = useSettings();
  const [editing, setEditing] = React.useState<AdvanceRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [paying, setPaying] = React.useState<AdvanceRow | null>(null);
  const { run } = useToastedTransition();

  const money = React.useCallback(
    (centimes: number) => formatMoney(centimes, locale, currency),
    [locale, currency],
  );

  // Stable so the column memo below can name it honestly — `useToastedTransition`
  // returns a stable `run` for exactly this reason.
  const decide = React.useCallback(
    (advance: AdvanceRow, approve: boolean) => {
      const data = new FormData();
      data.set("id", advance.id);
      data.set("approve", approve ? "1" : "0");
      run(() => decideAdvanceAction(IDLE, data));
    },
    [run],
  );

  const columns = React.useMemo<ColumnDef<AdvanceRow, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => `${row.staffName} ${row.staffCode}`,
        header: t.hr.employee,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.staffName}
            </p>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {row.original.staffCode}
            </p>
          </div>
        ),
      },
      {
        id: "amount",
        accessorFn: (row) => row.amountCentimes,
        header: t.hr.advanceAmount,
        cell: ({ row }) => (
          <div className="text-end">
            <p className="text-sm font-medium tabular-nums">
              {money(row.original.amountCentimes)}
            </p>
            {row.original.instalmentCount > 1 ? (
              <p className="text-muted-foreground text-xs">
                ×{row.original.instalmentCount}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "recovered",
        accessorFn: (row) => row.recoveredCentimes,
        header: t.hr.advanceRecovered,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {money(row.original.recoveredCentimes)}
          </span>
        ),
      },
      {
        id: "outstanding",
        accessorFn: (row) => row.outstandingCentimes,
        header: t.hr.advanceOutstanding,
        cell: ({ row }) => (
          <span
            className={
              row.original.outstandingCentimes > 0
                ? "text-warning text-sm font-medium tabular-nums"
                : "text-muted-foreground text-sm tabular-nums"
            }
          >
            {money(row.original.outstandingCentimes)}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        header: t.hr.leaveStatus,
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "CANCELLED"
                ? "outline"
                : row.original.status === "RECOVERED"
                  ? "secondary"
                  : "default"
            }
          >
            {t.hrOptions.advanceStatuses[
              row.original.status as keyof typeof t.hrOptions.advanceStatuses
            ] ?? row.original.status}
          </Badge>
        ),
      },
      {
        id: "requestedOn",
        accessorFn: (row) => row.requestedOn,
        header: t.hr.advanceReason,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs" dir="ltr">
            {formatDate(new Date(row.original.requestedOn), locale)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const advance = row.original;
          return (
            <div className="flex justify-end gap-1">
              {canManage && isAdvanceDecidable(advance.status) ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.hr.approve}
                    onClick={() => decide(advance, true)}
                  >
                    <CheckIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.hr.refuse}
                    onClick={() => decide(advance, false)}
                  >
                    <XIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.common.edit}
                    onClick={() => setEditing(advance)}
                  >
                    <PencilIcon />
                  </Button>
                </>
              ) : null}

              {/* Handing the money over is the caisse's act, not the payroll's. */}
              {canDisburse && isAdvancePayable(advance.status) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPaying(advance)}
                >
                  <HandCoinsIcon className="size-4" />
                  {t.hr.payAdvance}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, locale, money, decide, canManage, canDisburse],
  );

  const facets: FacetDef[] = [
    {
      columnId: "status",
      label: t.hr.leaveStatus,
      options: ADVANCE_STATUSES.map((status) => ({
        value: status,
        label: t.hrOptions.advanceStatuses[status],
      })),
    },
  ];

  const owed = advances.reduce(
    (total, advance) => total + advance.outstandingCentimes,
    0,
  );

  return (
    <div className="grid gap-4">
      {/* The one figure a director asks for: what the school is out of pocket. */}
      <div className="bg-card ring-foreground/10 flex flex-wrap items-center gap-3 rounded-xl p-4 ring-1">
        <BanknoteIcon className="text-muted-foreground size-5" />
        <div className="flex-1">
          <p className="text-muted-foreground text-xs">
            {t.hr.advanceOutstanding}
          </p>
          <p className="text-lg font-semibold tabular-nums">{money(owed)}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            {t.hr.newAdvance}
          </Button>
        ) : null}
      </div>

      {advances.length === 0 ? (
        <EmptyState
          icon={<HandCoinsIcon />}
          title={t.hr.noAdvances}
          description={t.hr.noAdvancesHint}
        />
      ) : (
        <DataTable data={advances} columns={columns} facets={facets} />
      )}

      {creating || editing ? (
        <AdvanceDialog
          advance={editing}
          staff={staff}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      {paying ? (
        <PayAdvanceDialog
          advance={paying}
          expenseCategories={expenseCategories}
          hasOpenSession={hasOpenSession}
          onClose={() => setPaying(null)}
        />
      ) : null}
    </div>
  );
}

/** Raising or restating a request. Editable only while nothing has happened. */
function AdvanceDialog({
  advance,
  staff,
  onClose,
}: {
  advance: AdvanceRow | null;
  staff: StaffOption[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [state, formAction] = React.useActionState(saveAdvanceAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>
              {advance ? t.hr.editAdvance : t.hr.newAdvance}
            </DialogTitle>
            <DialogDescription>{t.hr.advancesHint}</DialogDescription>
          </DialogHeader>

          {advance ? <input type="hidden" name="id" value={advance.id} /> : null}

          <div className="grid gap-4 py-4">
            <Field name="staffId" label={t.hr.employee} error={errors.staffId}>
              <Select
                name="staffId"
                defaultValue={advance?.staffId ?? staff[0]?.id}
              >
                <SelectTrigger id="staffId" className="w-full">
                  <SelectValue placeholder={t.hr.employee} />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="amount"
                label={t.hr.advanceAmount}
                error={errors.amount}
              >
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min={0}
                  dir="ltr"
                  defaultValue={valueOf(
                    state,
                    "amount",
                    advance ? String(advance.amountCentimes / 100) : "",
                  )}
                />
              </Field>

              <Field
                name="instalmentCount"
                label={t.hr.advanceInstalments}
                error={errors.instalmentCount}
              >
                <Input
                  id="instalmentCount"
                  name="instalmentCount"
                  type="number"
                  min={1}
                  max={24}
                  dir="ltr"
                  defaultValue={advance?.instalmentCount ?? 1}
                />
              </Field>
            </div>

            <Field name="reason" label={t.hr.advanceReason} error={errors.reason}>
              <Textarea
                id="reason"
                name="reason"
                rows={2}
                defaultValue={valueOf(state, "reason", advance?.reason)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Handing the money over.
 *
 * The same shape as paying a bulletin, because it is the same act: a
 * décaissement in the caisse, made out to an employee. Cash needs an open till;
 * the other methods never come near one.
 */
function PayAdvanceDialog({
  advance,
  expenseCategories,
  hasOpenSession,
  onClose,
}: {
  advance: AdvanceRow;
  expenseCategories: { id: string; label: string }[];
  hasOpenSession: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { currencyCode: currency } = useSettings();
  const [state, formAction] = React.useActionState(payAdvanceAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const [method, setMethod] = React.useState("CASH");

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{t.hr.payAdvance}</DialogTitle>
            <DialogDescription>
              {advance.staffName} ·{" "}
              {formatMoney(advance.amountCentimes, locale, currency)}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="advanceId" value={advance.id} />
          <input type="hidden" name="method" value={method} />

          <div className="grid gap-4 py-4">
            <Field name="method" label={t.hr.method}>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">
                    {t.treasuryOptions.methods.CASH}
                  </SelectItem>
                  <SelectItem value="CHEQUE">
                    {t.treasuryOptions.methods.CHEQUE}
                  </SelectItem>
                  <SelectItem value="BANK_TRANSFER">
                    {t.treasuryOptions.methods.BANK_TRANSFER}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {/* Cash lands in a drawer, so there has to be one open. Said before
              the button is pressed rather than after. */}
            {method === "CASH" && !hasOpenSession ? (
              <p className="text-warning text-xs text-pretty">
                {t.hr.noOpenSession}
              </p>
            ) : null}

            <Field name="categoryId" label={t.hr.expenseCategory}>
              <Select name="categoryId" defaultValue={expenseCategories[0]?.id}>
                <SelectTrigger id="categoryId" className="w-full">
                  <SelectValue placeholder={t.hr.expenseCategory} />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field name="paidOn" label={t.hr.paidOn}>
              <Input
                id="paidOn"
                name="paidOn"
                type="date"
                dir="ltr"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>

            {method === "CHEQUE" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="chequeNumber" label={t.hr.chequeNumber}>
                  <Input id="chequeNumber" name="chequeNumber" dir="ltr" />
                </Field>
                <Field name="bankName" label={t.hr.bankName}>
                  <Input id="bankName" name="bankName" />
                </Field>
              </div>
            ) : (
              <Field name="reference" label={t.hr.reference}>
                <Input id="reference" name="reference" dir="ltr" />
              </Field>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton disabled={method === "CASH" && !hasOpenSession}>
              {interpolate(t.hr.payAdvanceAmount, {
                amount: formatMoney(advance.amountCentimes, locale, currency),
              })}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
