"use client";

import { PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form/form-field";
import { SubmitButton } from "@/components/form/submit-button";
import { toastError } from "@/components/form/toast-error";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { IDLE } from "@/lib/action-state";
import { formatDateTime } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { topUpCreditsAction } from "@/modules/messaging/actions";
import type { CreditsOverview } from "@/modules/messaging/queries";

/** The platform owner's page: the balance, a top-up form, and every movement. */
export function CreditsManager({ overview }: { overview: CreditsOverview }) {
  const { t, locale } = useI18n();
  const m = t.messaging;
  const [state, action] = React.useActionState(topUpCreditsAction, IDLE);

  React.useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") {
      toastError(state.message ?? t.errors.unexpected);
    }
  }, [state, t.errors.unexpected]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
          <p className="text-muted-foreground text-xs">
            {m.creditsPage.balance}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {overview.balance}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.creditsPage.submit}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-4 sm:grid-cols-3">
            <FormField
              name="amount"
              label={m.creditsPage.amount}
              error={state.fieldErrors?.amount}
              required
            >
              <Input
                id="amount"
                name="amount"
                type="number"
                min={1}
                step={1}
                required
              />
            </FormField>
            <FormField
              name="note"
              label={m.creditsPage.note}
              className="sm:col-span-2"
            >
              <Input id="note" name="note" maxLength={500} />
            </FormField>
            <div className="sm:col-span-3">
              <SubmitButton>
                <PlusIcon />
                {m.creditsPage.submit}
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.creditsPage.ledger}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.ledger.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {m.creditsPage.emptyLedger}
            </p>
          ) : (
            <Table>
              <TableBody>
                {overview.ledger.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(line.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {
                          m.creditReasons[
                            line.reason as keyof typeof m.creditReasons
                          ]
                        }
                      </Badge>
                    </TableCell>
                    <TableCell
                      dir="ltr"
                      className={cn(
                        "text-end font-medium tabular-nums",
                        line.delta < 0 && "text-muted-foreground",
                      )}
                    >
                      {line.delta > 0 ? `+${line.delta}` : line.delta}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {line.note}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
