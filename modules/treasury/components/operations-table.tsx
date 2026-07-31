"use client";

import { ReceiptTextIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shell/empty-state";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatAmount, formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { cancelPaymentAction } from "@/modules/treasury/actions";
import { OPERATION_KINDS } from "@/modules/treasury/enums";
import type { OperationRow, PaymentRow } from "@/modules/treasury/queries";

/** What the receipts table renders. Aliased so the props read plainly. */
type PaymentSummary = PaymentRow;

/**
 * The Opérations ledger.
 *
 * Cancelled rows are struck through rather than hidden. A ledger that quietly
 * drops what was undone cannot be reconciled against the receipts a school
 * actually issued, and the correcting entry sitting two rows below is the whole
 * explanation of a total that would otherwise look wrong.
 */
export function OperationsTable({ operations }: { operations: OperationRow[] }) {
  const t = useT();
  const locale = useLocale();
  const [kind, setKind] = React.useState<string>("ALL");

  const rows = React.useMemo(
    () =>
      kind === "ALL"
        ? operations
        : operations.filter((operation) => operation.kind === kind),
    [operations, kind],
  );

  return (
    <Card>
      <CardContent className="grid gap-4 p-0">
        <div className="border-b p-3">
          <Tabs value={kind} onValueChange={setKind}>
            <TabsList>
              <TabsTrigger value="ALL">{t.common.all}</TabsTrigger>
              {OPERATION_KINDS.map((option) => (
                <TabsTrigger key={option} value={option}>
                  {t.treasuryOptions.kinds[option]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptTextIcon className="size-5" />}
            title={t.treasury.noOperations}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.treasury.occurredAt}</TableHead>
                  <TableHead>{t.treasury.kind}</TableHead>
                  <TableHead>{t.treasury.label}</TableHead>
                  <TableHead>{t.treasury.method}</TableHead>
                  <TableHead className="text-end">{t.treasury.amount}</TableHead>
                  <TableHead className="text-end">
                    {t.treasury.cashImpact}
                  </TableHead>
                  <TableHead>{t.treasury.recordedBy}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((operation) => {
                  // A reversed movement still happened and still counts toward
                  // the drawer — it is dimmed to explain the correcting entry
                  // below it, never struck out as if it had not occurred.
                  const cancelled =
                    operation.status === "CANCELLED" || operation.isReversed;

                  return (
                    <TableRow
                      key={operation.id}
                      className={cn(cancelled && "text-muted-foreground")}
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatDate(operation.occurredAt, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            operation.kind === "ENCAISSEMENT"
                              ? "default"
                              : operation.kind === "DECAISSEMENT"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {
                            t.treasuryOptions.kinds[
                              operation.kind as keyof typeof t.treasuryOptions.kinds
                            ]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            operation.status === "CANCELLED" && "line-through",
                          )}
                        >
                          {operation.label}
                        </span>
                        {operation.beneficiaryName ? (
                          <span className="text-muted-foreground block text-xs">
                            {operation.beneficiaryName}
                            {operation.categoryName
                              ? ` · ${operation.categoryName}`
                              : ""}
                          </span>
                        ) : null}
                        {operation.isReversal ? (
                          <Badge variant="outline" className="mt-1">
                            {t.treasury.reversalOf}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {
                          t.treasuryOptions.methods[
                            operation.method as keyof typeof t.treasuryOptions.methods
                          ]
                        }
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {operation.isReversal ? "−" : ""}
                        {formatAmount(operation.amountCentimes, locale)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {operation.cashImpactCentimes === 0
                          ? "—"
                          : `${operation.cashImpactCentimes > 0 ? "+" : ""}${formatAmount(operation.cashImpactCentimes, locale)}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {operation.createdByName}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The receipts list.
 *
 * Cancelling is handled in here rather than through a callback prop: this is
 * rendered from a Server Component, which cannot hand a function across the
 * boundary. The confirmation is not ceremony — cancelling puts money back on a
 * family's account, and the dialog names the receipt it is about to undo.
 */
export function ReceiptsTable({
  payments,
  canCancel,
}: {
  payments: PaymentSummary[];
  canCancel: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, setPending] = React.useState<PaymentSummary | null>(null);
  const [isCancelling, startCancelling] = React.useTransition();

  function confirmCancel() {
    if (!pending) return;
    startCancelling(async () => {
      const result = await cancelPaymentAction(pending.id, null);
      if (result.status === "success") {
        toast.success(result.message ?? t.treasury.paymentCancelled);
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
      setPending(null);
    });
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<ReceiptTextIcon className="size-5" />}
            title={t.treasury.noReceipts}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.treasury.receipt}</TableHead>
              <TableHead>{t.treasury.family}</TableHead>
              <TableHead>{t.treasury.paidAt}</TableHead>
              <TableHead>{t.treasury.method}</TableHead>
              <TableHead className="text-end">{t.treasury.amount}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const cancelled = payment.status === "CANCELLED";

              return (
                <TableRow
                  key={payment.id}
                  className={cn(cancelled && "text-muted-foreground")}
                >
                  <TableCell className="font-medium">
                    <span className={cn(cancelled && "line-through")}>
                      {payment.code}
                    </span>
                  </TableCell>
                  <TableCell>{payment.familyName ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(payment.paidAt, locale)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {payment.methods
                      .map(
                        (method) =>
                          t.treasuryOptions.methods[
                            method as keyof typeof t.treasuryOptions.methods
                          ],
                      )
                      .join(" + ")}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-end tabular-nums",
                      cancelled && "line-through",
                    )}
                  >
                    {formatAmount(payment.totalCentimes, locale)}
                  </TableCell>
                  <TableCell className="text-end">
                    {canCancel && !cancelled ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPending(payment)}
                      >
                        {t.treasury.cancelPayment}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.treasury.cancelPaymentTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(t.treasury.cancelPaymentBody, {
                code: pending?.code ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Cancelling is async; letting the dialog close itself would
                // unmount the transition before the toast lands.
                event.preventDefault();
                confirmCancel();
              }}
              disabled={isCancelling}
            >
              {t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
