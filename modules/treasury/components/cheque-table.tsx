"use client";

import { ReceiptTextIcon } from "lucide-react";
import * as React from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { EmptyState } from "@/components/shell/empty-state";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, formatDate, toDateInputValue } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { setChequeStatusAction } from "@/modules/treasury/actions";
import {
  CHEQUE_STATUSES,
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
export function ChequeTable({
  cheques,
  canManage,
}: {
  cheques: ChequeRow[];
  canManage: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [filter, setFilter] = React.useState<string>("ALL");
  const [pending, setPending] = React.useState<{
    cheque: ChequeRow;
    status: ChequeStatus;
  } | null>(null);

  const rows = React.useMemo(
    () =>
      filter === "ALL"
        ? cheques
        : cheques.filter((cheque) => cheque.status === filter),
    [cheques, filter],
  );

  const today = new Date().setHours(0, 0, 0, 0);

  return (
    <Card>
      <CardContent className="grid gap-0 p-0">
        <div className="overflow-x-auto border-b p-3">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="ALL">{t.common.all}</TabsTrigger>
              {CHEQUE_STATUSES.map((status) => (
                <TabsTrigger key={status} value={status}>
                  {t.treasuryOptions.chequeStatuses[status]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptTextIcon className="size-5" />}
            title={t.treasury.noCheques}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.treasury.number}</TableHead>
                  <TableHead>{t.treasury.drawerName}</TableHead>
                  <TableHead>{t.treasury.bankName}</TableHead>
                  <TableHead>{t.treasury.dueOn}</TableHead>
                  <TableHead className="text-end">{t.treasury.amount}</TableHead>
                  <TableHead>{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((cheque) => {
                  const failed = FAILED_CHEQUE_STATUSES.includes(
                    cheque.status as ChequeStatus,
                  );
                  // Held past its date: the one state that needs chasing.
                  const overdue =
                    cheque.status === "PENDING" &&
                    cheque.dueOn !== null &&
                    new Date(cheque.dueOn).getTime() < today;

                  return (
                    <TableRow key={cheque.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <span dir="ltr">{cheque.number}</span>
                          <Badge variant={failed ? "destructive" : "secondary"}>
                            {
                              t.treasuryOptions.chequeStatuses[
                                cheque.status as ChequeStatus
                              ]
                            }
                          </Badge>
                          {overdue ? (
                            <Badge variant="outline" className="text-destructive">
                              {t.treasury.overdueLabel}
                            </Badge>
                          ) : null}
                        </div>
                        {cheque.paymentCode ? (
                          <span className="text-muted-foreground block text-xs">
                            {cheque.paymentCode}
                            {cheque.familyName ? ` · ${cheque.familyName}` : ""}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{cheque.drawerName ?? "—"}</TableCell>
                      <TableCell>{cheque.bankName ?? "—"}</TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap",
                          overdue && "text-destructive font-medium",
                        )}
                      >
                        {formatDate(cheque.dueOn, locale)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatAmount(cheque.amountCentimes, locale)}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <div className="flex flex-wrap gap-1">
                            {cheque.status === "PENDING" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPending({ cheque, status: "DEPOSITED" })
                                }
                              >
                                {t.treasury.markDeposited}
                              </Button>
                            ) : null}
                            {cheque.status === "DEPOSITED" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setPending({ cheque, status: "CASHED" })
                                  }
                                >
                                  {t.treasury.markCashed}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setPending({ cheque, status: "BOUNCED" })
                                  }
                                >
                                  {t.treasury.markBounced}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {pending ? (
        <StatusDialog
          cheque={pending.cheque}
          status={pending.status}
          onClose={() => setPending(null)}
        />
      ) : null}
    </Card>
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
            <SubmitButton variant={status === "BOUNCED" ? "destructive" : "default"}>
              {t.common.confirm}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
