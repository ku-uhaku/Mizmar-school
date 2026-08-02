"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  BanknoteXIcon,
  LandmarkIcon,
  MoreHorizontalIcon,
  ReceiptTextIcon,
  Trash2Icon,
  UndoDotIcon,
  WalletIcon,
} from "lucide-react";
import * as React from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { EmptyState } from "@/components/shell/empty-state";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, formatDate, toDateInputValue } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { setChequeStatusAction } from "@/modules/treasury/actions";
import {
  CHEQUE_STATUSES,
  CHEQUE_TRANSITIONS,
  FAILED_CHEQUE_STATUSES,
  type ChequeStatus,
} from "@/modules/treasury/enums";
import type { ChequeRow } from "@/modules/treasury/queries";

/**
 * Suivi Chèques.
 *
 * Sorted by due date because that is the question the screen exists to answer:
 * what must be banked this week, and what is already past its date and still
 * sitting in the safe. A cheque banked before the date written on it comes back
 * unpaid, so the ones not yet due are marked rather than hidden.
 */
/**
 * How each move is offered: its icon, its label and whether it is a red one.
 *
 * Keyed on the status moved *to*, so `CHEQUE_TRANSITIONS` stays the single
 * declaration of what is legal and this only says how to draw it. A status
 * added to the table without an entry here is a compile error rather than a
 * blank menu row.
 */
const CHEQUE_MOVES: Record<
  string,
  {
    icon: typeof WalletIcon;
    labelKey: "markDeposited" | "markCashed" | "markBounced" | "markReturned" | "markCancelled";
    destructive?: boolean;
  }
> = {
  DEPOSITED: { icon: LandmarkIcon, labelKey: "markDeposited" },
  CASHED: { icon: WalletIcon, labelKey: "markCashed" },
  BOUNCED: { icon: BanknoteXIcon, labelKey: "markBounced", destructive: true },
  // Handed back to the family — the paper leaves, and no money ever arrived.
  RETURNED: { icon: UndoDotIcon, labelKey: "markReturned" },
  CANCELLED: { icon: Trash2Icon, labelKey: "markCancelled", destructive: true },
};

export function ChequeTable({
  cheques,
  canManage,
}: {
  cheques: ChequeRow[];
  canManage: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, setPending] = React.useState<{
    cheque: ChequeRow;
    status: ChequeStatus;
  } | null>(null);

  const today = new Date().setHours(0, 0, 0, 0);

  /** Held past its date: the one state that needs chasing. */
  const isOverdue = React.useCallback(
    (cheque: ChequeRow) =>
      cheque.status === "PENDING" &&
      cheque.dueOn !== null &&
      new Date(cheque.dueOn).getTime() < today,
    [today],
  );

  const columns = React.useMemo<ColumnDef<ChequeRow, unknown>[]>(() => {
    const list: ColumnDef<ChequeRow, unknown>[] = [
      {
        id: "number",
        accessorFn: (row) =>
          `${row.number} ${row.paymentCode ?? ""} ${row.familyName ?? ""}`,
        header: t.treasury.number,
        cell: ({ row }) => {
          const cheque = row.original;
          return (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium" dir="ltr">
                  {cheque.number}
                </span>
                {isOverdue(cheque) ? (
                  <Badge variant="outline" className="text-destructive">
                    {t.treasury.overdueLabel}
                  </Badge>
                ) : null}
              </div>
              {cheque.paymentCode ? (
                <p className="text-muted-foreground truncate text-xs">
                  {cheque.paymentCode}
                  {cheque.familyName ? ` · ${cheque.familyName}` : ""}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: t.school.status,
        cell: ({ row }) => (
          <Badge
            variant={
              FAILED_CHEQUE_STATUSES.includes(
                row.original.status as ChequeStatus,
              )
                ? "destructive"
                : "secondary"
            }
          >
            {
              t.treasuryOptions.chequeStatuses[
                row.original.status as ChequeStatus
              ]
            }
          </Badge>
        ),
      },
      {
        id: "drawerName",
        accessorFn: (row) => row.drawerName ?? "",
        header: t.treasury.drawerName,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.drawerName ?? "—"}</span>
        ),
      },
      {
        id: "bankName",
        accessorFn: (row) => row.bankName ?? "",
        header: t.treasury.bankName,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.bankName ?? "—"}</span>
        ),
      },
      {
        // Sorted on by default upstream: what must be banked this week is the
        // question the screen exists to answer.
        accessorKey: "dueOn",
        header: t.treasury.dueOn,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-sm whitespace-nowrap",
              isOverdue(row.original) && "text-destructive font-medium",
            )}
          >
            {formatDate(row.original.dueOn, locale)}
          </span>
        ),
      },
      {
        accessorKey: "amountCentimes",
        header: t.treasury.amount,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatAmount(row.original.amountCentimes, locale)}
          </span>
        ),
      },
    ];

    if (canManage) {
      list.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const cheque = row.original;

          /*
            The menu *is* the transition table.

            It used to offer three moves out of six statuses and nothing at all
            from BOUNCED, which left a re-presented cheque stranded. Generating
            it from `CHEQUE_TRANSITIONS` means the screen and `setChequeStatus`
            can never disagree about what is legal — and adding a status to the
            table puts it on the menu without touching this file.
          */
          const moves = CHEQUE_TRANSITIONS[cheque.status] ?? [];
          if (moves.length === 0) return null;

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
                  {moves.map((next) => {
                    const move = CHEQUE_MOVES[next];
                    const Icon = move.icon;
                    return (
                      <DropdownMenuItem
                        key={next}
                        variant={move.destructive ? "destructive" : undefined}
                        onSelect={() => setPending({ cheque, status: next })}
                      >
                        <Icon />
                        {t.treasury[move.labelKey]}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      });
    }

    return list;
  }, [t, locale, canManage, isOverdue]);

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "status",
        label: t.school.status,
        options: CHEQUE_STATUSES.map((status) => ({
          value: status,
          label: t.treasuryOptions.chequeStatuses[status],
        })),
      },
    ],
    [t],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={cheques}
        facets={facets}
        pageSize={20}
        emptyState={
          <EmptyState
            icon={<ReceiptTextIcon className="size-5" />}
            title={t.treasury.noCheques}
          />
        }
      />

      {pending ? (
        <StatusDialog
          cheque={pending.cheque}
          status={pending.status}
          onClose={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

function StatusDialog({
  cheque,
  status,
  onClose,
}: {
  cheque: ChequeRow;
  status: ChequeStatus;
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(setChequeStatusAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {t.treasuryOptions.chequeStatuses[status]} · {cheque.number}
            </DialogTitle>
            <DialogDescription>{t.treasury.chequesSubtitle}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={cheque.id} />
          <input type="hidden" name="status" value={status} />

          {/* Bouncing is not just a status: it undoes a receipt. Say so. */}
          {status === "BOUNCED" ? (
            <Alert variant="destructive">
              <AlertDescription>{t.treasury.bouncedWarning}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="settledOn">{t.treasury.settledOn}</Label>
            <Input
              id="settledOn"
              name="settledOn"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              dir="ltr"
            />
          </div>

          {status === "BOUNCED" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="bounceReason">{t.treasury.bounceReason}</Label>
              <Textarea id="bounceReason" name="bounceReason" rows={2} />
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <SubmitButton
              variant={status === "BOUNCED" ? "destructive" : "default"}
            >
              {t.common.confirm}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
