"use client";

import { LockIcon, UnlockIcon } from "lucide-react";
import * as React from "react";

import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, formatDateTime } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  closeSessionAction,
  openSessionAction,
} from "@/modules/treasury/actions";
import { centimesToDirhams } from "@/modules/treasury/enums";
import type { RegisterRow } from "@/modules/treasury/queries";

/**
 * The state of every till, and the two buttons that change it.
 *
 * The expected figure is shown while the drawer is open, on purpose: a cashier
 * who can see what the ledger thinks is there will notice a discrepancy in the
 * afternoon rather than at closing time, when nobody remembers what happened.
 */
export function SessionBar({
  registers,
  canManage,
}: {
  registers: RegisterRow[];
  canManage: boolean;
}) {
  const t = useT();
  const { currencyCode: currency } = useSettings();
  const locale = useLocale();

  if (registers.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          {t.treasury.noRegisters}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {registers.map((register) => (
        <Card key={register.id}>
          <CardContent className="grid gap-3 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{register.name}</p>
                <p className="text-muted-foreground text-xs">{register.code}</p>
              </div>
              <Badge variant={register.openSession ? "default" : "secondary"}>
                {register.openSession
                  ? t.treasury.statusOpen
                  : t.treasury.statusClosed}
              </Badge>
            </div>

            {register.openSession ? (
              <>
                <dl className="grid gap-1 text-sm">
                  <Line
                    label={t.treasury.inDrawer}
                    value={`${formatAmount(register.openSession.expectedCentimes, locale)} ${currency}`}
                    strong
                  />
                  <Line
                    label={t.treasury.openedBy}
                    value={register.openSession.openedByName}
                  />
                  <Line
                    label={t.treasury.openedAt}
                    value={formatDateTime(
                      register.openSession.openedAt,
                      locale,
                    )}
                  />
                </dl>

                {canManage ? (
                  <CloseDialog
                    sessionId={register.openSession.id}
                    expectedCentimes={register.openSession.expectedCentimes}
                  />
                ) : null}
              </>
            ) : canManage ? (
              <OpenDialog registerId={register.id} />
            ) : (
              <p className="text-muted-foreground text-xs">
                {t.treasury.noOpenSession}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}

function OpenDialog({ registerId }: { registerId: string }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(openSessionAction, IDLE);
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <UnlockIcon className="size-4" />
          {t.treasury.openSession}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.treasury.openSession}</DialogTitle>
            <DialogDescription>{t.treasury.openingFloatHint}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="cashRegisterId" value={registerId} />

          <div className="grid gap-1.5">
            <Label htmlFor="openingFloat">{t.treasury.openingFloat}</Label>
            <Input
              id="openingFloat"
              name="openingFloat"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0.00"
              dir="ltr"
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="openNotes">{t.treasury.notes}</Label>
            <Textarea id="openNotes" name="notes" rows={2} />
          </div>

          <DialogFooter>
            <SubmitButton>{t.treasury.openSession}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({
  sessionId,
  expectedCentimes,
}: {
  sessionId: string;
  expectedCentimes: number;
}) {
  const t = useT();
  const locale = useLocale();
  const { currencyCode: currency } = useSettings();
  const [open, setOpen] = React.useState(false);
  const [counted, setCounted] = React.useState("");
  const [state, formAction] = React.useActionState(closeSessionAction, IDLE);
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  const countedCentimes = Math.round((Number(counted) || 0) * 100);
  const variance = counted === "" ? null : countedCentimes - expectedCentimes;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <LockIcon className="size-4" />
          {t.treasury.closeSession}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.treasury.closeSession}</DialogTitle>
            <DialogDescription>{t.treasury.countedHint}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={sessionId} />

          <div className="grid gap-1.5">
            <Label htmlFor="counted">{t.treasury.counted}</Label>
            <Input
              id="counted"
              name="counted"
              value={counted}
              onChange={(event) => setCounted(event.target.value)}
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              placeholder="0.00"
              required
              autoFocus
            />
          </div>

          {/*
            The expected figure is shown *beside* the box rather than pre-filled
            into it. A cashier handed the answer will confirm it without
            counting, and the variance — the only reason to close a till
            formally — would never be anything but zero.
          */}
          <dl className="grid gap-1 rounded-lg border p-3 text-sm">
            <Line
              label={t.treasury.expected}
              value={`${formatAmount(expectedCentimes, locale)} ${currency}`}
            />
            {variance !== null ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t.treasury.variance}</dt>
                <dd
                  className={cn(
                    "font-semibold tabular-nums",
                    variance !== 0 && "text-destructive",
                  )}
                >
                  {variance > 0 ? "+" : ""}
                  {centimesToDirhams(variance).toFixed(2)} {currency}
                  {variance !== 0 ? (
                    <span className="ms-2 text-xs font-normal">
                      {variance < 0
                        ? t.treasury.varianceShort
                        : t.treasury.varianceOver}
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="grid gap-1.5">
            <Label htmlFor="closeNotes">{t.treasury.notes}</Label>
            <Textarea id="closeNotes" name="notes" rows={2} />
          </div>

          <DialogFooter>
            <SubmitButton variant="outline">
              {t.treasury.closeSession}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The till picker used by the transfer form, where the source must be open. */
export function RegisterSelect({
  registers,
  name,
  id,
  defaultValue,
  openOnly = false,
}: {
  registers: RegisterRow[];
  name: string;
  id: string;
  defaultValue?: string;
  openOnly?: boolean;
}) {
  const t = useT();
  const options = openOnly
    ? registers.filter((register) => register.openSession !== null)
    : registers;

  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t.treasury.register} />
      </SelectTrigger>
      <SelectContent>
        {options.map((register) => (
          <SelectItem key={register.id} value={register.id}>
            {register.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
