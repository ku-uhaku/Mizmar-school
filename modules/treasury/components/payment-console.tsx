"use client";

import { Loader2Icon, PlusIcon, TrashIcon, WalletIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { FormField } from "@/components/form/form-field";
import { FormSection } from "@/components/form/form-page";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import {
  formatAmount,
  formatMonth,
  interpolate,
  toDateInputValue,
} from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { recordPaymentAction } from "@/modules/treasury/actions";
import {
  TENDER_METHODS,
  centimesToDirhams,
  dirhamsToCentimes,
  type TenderMethod,
} from "@/modules/treasury/enums";
import {
  PAYMENT_STATE_STYLES,
  paymentStateOf,
} from "@/modules/treasury/payment-state";
import type {
  BankOption,
  FamilyOption,
  PayableFamily,
  PayableLine,
} from "@/modules/treasury/queries";

/**
 * The encaissement screen.
 *
 * ── Why it is shaped like this ───────────────────────────────────────────────
 * A parent at the desk does not say "apply 3 000 dirhams to my account". They
 * say "je paie octobre et novembre pour Yasmine, et l'assurance des deux" — so
 * the screen is a list of the actual charges, grouped by month, with a checkbox
 * on each. Nothing is auto-applied to the oldest debt: what the receipt says it
 * settled is what the family chose, because in three months' time somebody will
 * ask.
 *
 * Every child of the household is on the same screen for the same reason. A
 * fratrie is one payment and one receipt, not three transactions, and putting
 * the children behind a picker would quietly force the opposite.
 *
 * The amount stays editable after a line is ticked, because part payment is
 * ordinary — a family clears what it can this month and the rest stays owed.
 */

type Props = {
  families: FamilyOption[];
  family: PayableFamily | null;
  /** The school's declared banks, for the cheque and virement tenders. */
  banks: BankOption[];
  /** Null when no till is open — cash cannot be taken, and the screen says so. */
  hasOpenSession: boolean;
  /**
   * Rendered inside a pupil's file rather than as the caisse screen.
   *
   * The family is already decided, so the picker is dropped — offering it would
   * let somebody standing on Yasmine's file collect for a different household.
   * Everything below it is the same component, deliberately: a second
   * implementation of "take a payment" is a second place for the allocation
   * rules to drift.
   */
  embedded?: boolean;
  /** Called after a receipt is written, so the sheet can close itself. */
  onDone?: () => void;
};

type Tender = {
  key: string;
  method: TenderMethod;
  amount: string;
  reference: string;
  /** The declared bank, when it is one of the school's. */
  bankId: string;
  bankName: string;
  chequeNumber: string;
  chequeDueOn: string;
  drawerName: string;
};

function emptyTender(method: TenderMethod = "CASH"): Tender {
  return {
    key: crypto.randomUUID(),
    method,
    amount: "",
    reference: "",
    bankId: "",
    bankName: "",
    chequeNumber: "",
    chequeDueOn: "",
    drawerName: "",
  };
}

/** Groups a child's charges into the month they fall due in. */
function byMonth(lines: PayableLine[]) {
  const months = new Map<
    string,
    { year: number; month: number; lines: PayableLine[] }
  >();

  for (const line of lines) {
    const key = `${line.dueYear}-${String(line.dueMonth).padStart(2, "0")}`;
    const bucket = months.get(key);
    if (bucket) {
      bucket.lines.push(line);
    } else {
      months.set(key, {
        year: line.dueYear,
        month: line.dueMonth,
        lines: [line],
      });
    }
  }

  return Array.from(months.entries()).map(([key, value]) => ({
    key,
    ...value,
  }));
}

export function PaymentConsole({
  families,
  family,
  banks,
  hasOpenSession,
  embedded = false,
  onDone,
}: Props) {
  const t = useT();
  const { currencyCode: currency } = useSettings();
  const locale = useLocale();
  const router = useRouter();

  const [state, formAction, isPending] = React.useActionState(
    recordPaymentAction,
    IDLE,
  );
  useActionFeedback(state, {
    onSuccess: () => {
      setSelection({});
      setTenders([emptyTender()]);
      setPaying(false);
      router.refresh();
      onDone?.();
    },
  });

  /*
    Two steps: choose the charges on the page, settle them in a sheet.

    They were one long form, and the two halves compete — the charges are a list
    you scan and tick, the tenders are a form you fill in, and under one Save
    you scrolled past twenty lines to discover the amounts did not balance.
    Splitting them also matches the desk: the parent says what they are paying,
    *then* hands over the money.

    Radix portals the sheet outside the <form>, so everything the action reads
    is rendered as hidden inputs inside it and the sheet only edits state. That
    is also why the confirm button carries `form={formId}` and takes its pending
    flag from `useActionState` — `useFormStatus` only sees an enclosing form.
  */
  const formId = React.useId();
  const [paying, setPaying] = React.useState(false);
  const [paidAt, setPaidAt] = React.useState(toDateInputValue(new Date()));
  const [notes, setNotes] = React.useState("");

  /** Fee line id → the amount being paid against it, in dirhams. */
  const [selection, setSelection] = React.useState<Record<string, string>>({});
  const [tenders, setTenders] = React.useState<Tender[]>([emptyTender()]);

  const money = (centimes: number) => formatAmount(centimes, locale);

  const allLines = React.useMemo(
    () => (family?.children ?? []).flatMap((child) => child.lines),
    [family],
  );

  const selectedTotalCentimes = React.useMemo(
    () =>
      Object.entries(selection).reduce((total, [, amount]) => {
        const value = Number(amount);
        return total + (Number.isFinite(value) ? dirhamsToCentimes(value) : 0);
      }, 0),
    [selection],
  );

  const tenderTotalCentimes = React.useMemo(
    () =>
      tenders.reduce((total, tender) => {
        const value = Number(tender.amount);
        return total + (Number.isFinite(value) ? dirhamsToCentimes(value) : 0);
      }, 0),
    [tenders],
  );

  const selectedCount = Object.keys(selection).length;

  const takesCash = tenders.some(
    (tender) => tender.method === "CASH" && Number(tender.amount) > 0,
  );
  const balanced =
    selectedTotalCentimes > 0 && selectedTotalCentimes === tenderTotalCentimes;

  function toggleLine(line: PayableLine, checked: boolean) {
    setSelection((current) => {
      const next = { ...current };
      if (checked) {
        // Ticking a line offers the whole of what it still owes; the cashier
        // overwrites the figure for a part payment.
        next[line.id] = centimesToDirhams(line.outstandingCentimes).toFixed(2);
      } else {
        delete next[line.id];
      }
      return next;
    });
  }

  function setLineAmount(lineId: string, amount: string) {
    setSelection((current) => ({ ...current, [lineId]: amount }));
  }

  function selectEverything() {
    const next: Record<string, string> = {};
    for (const line of allLines) {
      if (line.outstandingCentimes > 0) {
        next[line.id] = centimesToDirhams(line.outstandingCentimes).toFixed(2);
      }
    }
    setSelection(next);
  }

  function updateTender(key: string, patch: Partial<Tender>) {
    setTenders((current) =>
      current.map((tender) =>
        tender.key === key ? { ...tender, ...patch } : tender,
      ),
    );
  }

  /** Fills the first tender with whatever is still unaccounted for. */
  function matchSelection() {
    const remaining = selectedTotalCentimes - tenderTotalCentimes;
    const first = tenders[0];
    if (!first) return;
    const current = Number(first.amount) || 0;
    updateTender(first.key, {
      amount: (current + centimesToDirhams(remaining)).toFixed(2),
    });
  }

  return (
    <form id={formId} action={formAction} className="grid gap-4 sm:gap-5">
      {embedded ? (
        <input type="hidden" name="familyId" value={family?.familyId ?? ""} />
      ) : (
        <FormSection
          title={t.treasury.family}
          description={t.treasury.selectFamilyHint}
        >
          <FormField name="familyId" label={t.treasury.selectFamily}>
            <Select
              value={family?.familyId ?? ""}
              // Navigating rather than fetching: the payable schedule is a
              // permission-scoped server read, and the URL then survives a reload.
              onValueChange={(value) =>
                router.push(`/caisse/encaissement?family=${value}`)
              }
            >
              <SelectTrigger id="familyId" className="w-full">
                <SelectValue placeholder={t.treasury.selectFamily} />
              </SelectTrigger>
              <SelectContent>
                {families.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name} · {option.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <input type="hidden" name="familyId" value={family?.familyId ?? ""} />
        </FormSection>
      )}

      {!family ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {t.treasury.noFamilySelected}
          </CardContent>
        </Card>
      ) : family.outstandingCentimes === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {t.treasury.nothingOwed}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {t.treasury.owesTotal}:{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {money(family.outstandingCentimes)} {currency}
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectEverything}
              >
                {t.treasury.selectAll}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelection({})}
              >
                {t.treasury.clearSelection}
              </Button>
            </div>
          </div>

          {family.children.map((child) => (
            <Card key={child.studentId}>
              <CardHeader className="border-b">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {child.studentName}
                  <Badge variant="outline">{child.studentCode}</Badge>
                  {child.className ? (
                    <Badge variant="secondary">{child.className}</Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  {t.treasury.owes}: {money(child.outstandingCentimes)}{" "}
                  {currency}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {child.lines.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    {t.treasury.nothingOwed}
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {byMonth(child.lines).map((month) => (
                      <MonthCard
                        key={month.key}
                        title={formatMonth(month.year, month.month, locale)}
                        lines={month.lines}
                        selection={selection}
                        onToggle={toggleLine}
                        onAmountChange={setLineAmount}
                        money={money}
                        currency={currency}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* The selected lines travel as `feeId:amount` pairs. */}
          {Object.entries(selection).map(([lineId, amount]) => (
            <input
              key={lineId}
              type="hidden"
              name="allocation"
              value={`${lineId}:${amount}`}
            />
          ))}

          {/*
            Everything the action reads, rendered inside the form from state —
            the sheet below is portaled out of it by Radix and its fields would
            otherwise never be submitted. See the note at the top.
          */}
          {tenders.map((tender) => (
            <TenderFields key={tender.key} tender={tender} />
          ))}
          <input type="hidden" name="paidAt" value={paidAt} />
          <input type="hidden" name="notes" value={notes} />

          {/*
            The bar that closes step one. Sticky in both modes now, not only the
            embedded one: the charges run past a screenful for any household
            with two children, and a total you have to scroll to find is a total
            nobody checks.
          */}
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 backdrop-blur">
            <div className="grid gap-0.5">
              <span className="text-muted-foreground text-xs">
                {t.treasury.selected}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  selectedTotalCentimes > 0 && "text-primary",
                )}
              >
                {money(selectedTotalCentimes)} {currency}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedCount > 0 ? (
                <Badge variant="secondary" className="tabular-nums">
                  {interpolate(t.treasury.linesChosen, {
                    count: selectedCount,
                  })}
                </Badge>
              ) : null}
              <Button
                type="button"
                size="lg"
                disabled={selectedTotalCentimes <= 0}
                onClick={() => {
                  // Paying the whole of what was ticked is the commonest case
                  // by far, so the sheet opens already balanced. Overtyping it
                  // is the exception, not the rule.
                  if (tenderTotalCentimes === 0) matchSelection();
                  setPaying(true);
                }}
              >
                <WalletIcon className="size-4" />
                {t.treasury.collect}
              </Button>
            </div>
          </div>

          <PaymentSheet
            open={paying}
            onOpenChange={setPaying}
            formId={formId}
            isPending={isPending}
            tenders={tenders}
            banks={banks}
            onChangeTender={updateTender}
            onAddTender={() =>
              setTenders((current) => [...current, emptyTender("CHEQUE")])
            }
            onRemoveTender={(key) =>
              setTenders((current) =>
                current.filter((entry) => entry.key !== key),
              )
            }
            onMatch={matchSelection}
            paidAt={paidAt}
            onPaidAtChange={setPaidAt}
            notes={notes}
            onNotesChange={setNotes}
            selectedTotalCentimes={selectedTotalCentimes}
            tenderTotalCentimes={tenderTotalCentimes}
            balanced={balanced}
            takesCash={takesCash}
            hasOpenSession={hasOpenSession}
            money={money}
            currency={currency}
            t={t}
          />
        </>
      )}
    </form>
  );
}

/**
 * The submitted half of a tender, rendered inside the form.
 *
 * Separate from `TenderRow` because the editor lives in a portaled sheet: the
 * fields the action reads have to sit in the form's own DOM, and one component
 * cannot be in two places at once.
 */
function TenderFields({ tender }: { tender: Tender }) {
  return (
    <>
      <input type="hidden" name="tenderMethod" value={tender.method} />
      <input type="hidden" name="tenderAmount" value={tender.amount} />
      <input type="hidden" name="tenderReference" value={tender.reference} />
      <input type="hidden" name="tenderBankId" value={tender.bankId} />
      <input type="hidden" name="tenderBank" value={tender.bankName} />
      <input
        type="hidden"
        name="tenderChequeNumber"
        value={tender.chequeNumber}
      />
      <input
        type="hidden"
        name="tenderChequeDueOn"
        value={tender.chequeDueOn}
      />
      <input type="hidden" name="tenderDrawer" value={tender.drawerName} />
    </>
  );
}

/**
 * Step two: how the money arrives, and the confirmation.
 *
 * A sheet rather than the foot of the page because it is a different question
 * from "what are we paying", and because a cashier who has ticked the wrong
 * month wants to go *back* — which a modal makes obvious and a scroll position
 * does not.
 *
 * The reconciliation is the loudest thing in it. A receipt whose tenders do not
 * add up to what it settles cannot be corrected later without cancelling the
 * receipt, so the difference is stated in words as well as colour and the
 * confirm button stays disabled until it is nil.
 */
function PaymentSheet({
  open,
  onOpenChange,
  formId,
  isPending,
  tenders,
  banks,
  onChangeTender,
  onAddTender,
  onRemoveTender,
  onMatch,
  paidAt,
  onPaidAtChange,
  notes,
  onNotesChange,
  selectedTotalCentimes,
  tenderTotalCentimes,
  balanced,
  takesCash,
  hasOpenSession,
  money,
  currency,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  isPending: boolean;
  tenders: Tender[];
  banks: BankOption[];
  onChangeTender: (key: string, patch: Partial<Tender>) => void;
  onAddTender: () => void;
  onRemoveTender: (key: string) => void;
  onMatch: () => void;
  paidAt: string;
  onPaidAtChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  selectedTotalCentimes: number;
  tenderTotalCentimes: number;
  balanced: boolean;
  takesCash: boolean;
  hasOpenSession: boolean;
  money: (centimes: number) => string;
  currency: string;
  t: ReturnType<typeof useT>;
}) {
  const difference = selectedTotalCentimes - tenderTotalCentimes;
  const blocked = !balanced || (takesCash && !hasOpenSession);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.treasury.collect}</DialogTitle>
          <DialogDescription>{t.treasury.tendersHint}</DialogDescription>
        </DialogHeader>

        {/* What is being settled, restated: the sheet covers the list, and
          confirming an amount you can no longer see is how the wrong one gets
          taken. */}
        <div className="bg-muted/50 flex items-center justify-between gap-4 rounded-lg px-4 py-3">
          <span className="text-muted-foreground text-sm">
            {t.treasury.selected}
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {money(selectedTotalCentimes)} {currency}
          </span>
        </div>

        <div className="grid gap-4">
          {tenders.map((tender, index) => (
            <TenderRow
              key={tender.key}
              tender={tender}
              banks={banks}
              index={index}
              canRemove={tenders.length > 1}
              onChange={onChangeTender}
              onRemove={onRemoveTender}
              t={t}
            />
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddTender}
            >
              <PlusIcon className="size-4" />
              {t.treasury.addTender}
            </Button>
            {difference !== 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={onMatch}>
                {t.treasury.payFull}
              </Button>
            ) : null}
          </div>

          <Separator />

          <FormField name="paidAtDisplay" label={t.treasury.paidAt}>
            <Input
              id="paidAtDisplay"
              type="date"
              value={paidAt}
              onChange={(event) => onPaidAtChange(event.target.value)}
              dir="ltr"
            />
          </FormField>

          <FormField name="notesDisplay" label={t.treasury.notes}>
            <Textarea
              id="notesDisplay"
              rows={2}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
            />
          </FormField>

          {/* Green when it balances, red when it does not — and never colour
            alone, so each state says what it is. */}
          <div
            className={cn(
              "grid gap-2 rounded-lg border p-3 text-sm",
              balanced
                ? "border-success/40 bg-success/5"
                : "border-destructive/40 bg-destructive/5",
            )}
          >
            <Row
              label={t.treasury.tenders}
              value={`${money(tenderTotalCentimes)} ${currency}`}
              tone={balanced ? "ok" : "warn"}
            />
            {difference !== 0 ? (
              <Row
                label={
                  difference > 0 ? t.treasury.stillToCover : t.treasury.overPaid
                }
                value={`${money(Math.abs(difference))} ${currency}`}
                tone="warn"
              />
            ) : null}
            {!balanced ? (
              <p className="text-destructive text-xs">
                {t.treasury.tendersMustMatch}
              </p>
            ) : null}
            {takesCash && !hasOpenSession ? (
              <p className="text-destructive text-xs">
                {t.treasury.noOpenSession}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t.treasury.backToCharges}
          </Button>
          {/* `form` rather than nesting: the sheet is portaled out of it. */}
          <Button
            type="submit"
            form={formId}
            size="lg"
            disabled={blocked || isPending}
          >
            {isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <WalletIcon className="size-4" />
            )}
            {t.treasury.recordPayment}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          tone === "ok" && "text-success",
          tone === "warn" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** One month of one child's schedule: a card of tickable charges. */
function MonthCard({
  title,
  lines,
  selection,
  onToggle,
  onAmountChange,
  money,
  currency,
  t,
}: {
  title: string;
  lines: PayableLine[];
  selection: Record<string, string>;
  onToggle: (line: PayableLine, checked: boolean) => void;
  onAmountChange: (lineId: string, amount: string) => void;
  money: (centimes: number) => string;
  currency: string;
  t: ReturnType<typeof useT>;
}) {
  const outstanding = lines.reduce(
    (total, line) => total + line.outstandingCentimes,
    0,
  );
  const settled = outstanding === 0;

  // The month wears its worst line: one late charge in January is what makes
  // January the card to open, whatever the other three are doing.
  const monthState = settled
    ? "SETTLED"
    : lines.some(
          (line) =>
            paymentStateOf({
              amountCentimes: line.amountCentimes,
              paidCentimes: line.paidCentimes,
              dueDate: line.dueDate,
            }) === "OVERDUE",
        )
      ? "OVERDUE"
      : lines.some((line) => line.paidCentimes > 0)
        ? "PARTIAL"
        : "UPCOMING";

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        PAYMENT_STATE_STYLES[monthState].surface,
        settled && "opacity-70",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium capitalize">{title}</p>
        <span
          className={cn(
            "text-xs tabular-nums",
            PAYMENT_STATE_STYLES[monthState].text,
          )}
        >
          {money(outstanding)}
        </span>
      </div>

      <div className="grid gap-2">
        {lines.map((line) => {
          const checked = line.id in selection;
          const done = line.outstandingCentimes === 0;
          // Colour says which charges are actually late, so a cashier ticking
          // through a long schedule settles those first without reading dates.
          const state = paymentStateOf({
            amountCentimes: line.amountCentimes,
            paidCentimes: line.paidCentimes,
            dueDate: line.dueDate,
          });

          return (
            <div key={line.id} className="grid gap-1">
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`line-${line.id}`}
                  checked={checked}
                  disabled={done}
                  onCheckedChange={(value) => onToggle(line, value === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`line-${line.id}`}
                  className="grid flex-1 cursor-pointer gap-0.5 text-xs font-normal"
                >
                  <span className="font-medium">{line.feeTypeName}</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      PAYMENT_STATE_STYLES[state].text,
                    )}
                  >
                    {done
                      ? t.treasury.alreadyPaid
                      : `${money(line.outstandingCentimes)} ${currency}`}
                    {line.paidCentimes > 0 && !done
                      ? ` · ${t.treasury.alreadyPaid} ${money(line.paidCentimes)}`
                      : ""}
                    {state === "OVERDUE"
                      ? ` · ${t.treasuryOptions.paymentStates.OVERDUE}`
                      : ""}
                  </span>
                </Label>
              </div>

              {/* Editable once ticked: part payment is ordinary. */}
              {checked ? (
                <Input
                  value={selection[line.id] ?? ""}
                  onChange={(event) =>
                    onAmountChange(line.id, event.target.value)
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  max={centimesToDirhams(line.outstandingCentimes)}
                  dir="ltr"
                  className="h-8 text-xs"
                  aria-label={t.treasury.partAmount}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One form of money on the receipt. */
function TenderRow({
  banks,
  tender,
  index,
  canRemove,
  onChange,
  onRemove,
  t,
}: {
  tender: Tender;
  banks: BankOption[];
  index: number;
  canRemove: boolean;
  onChange: (key: string, patch: Partial<Tender>) => void;
  onRemove: (key: string) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      {/*
        The action reads these as parallel arrays indexed by tender, so every
        tender must contribute exactly one value to every field — including the
        ones its method does not use. Emitting the whole block here, once,
        instead of alongside each visible input is what makes that structural:
        a cheque with no reference cannot shift the next tender's bank name.
      */}
      <input type="hidden" name="tenderMethod" value={tender.method} />
      <input type="hidden" name="tenderAmount" value={tender.amount} />
      <input type="hidden" name="tenderReference" value={tender.reference} />
      <input type="hidden" name="tenderBankId" value={tender.bankId} />
      <input type="hidden" name="tenderBank" value={tender.bankName} />
      <input
        type="hidden"
        name="tenderChequeNumber"
        value={tender.method === "CHEQUE" ? tender.chequeNumber : ""}
      />
      <input
        type="hidden"
        name="tenderChequeDueOn"
        value={tender.method === "CHEQUE" ? tender.chequeDueOn : ""}
      />
      <input
        type="hidden"
        name="tenderDrawer"
        value={tender.method === "CHEQUE" ? tender.drawerName : ""}
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`tenderMethod-${index}`}>{t.treasury.method}</Label>
          <Select
            value={tender.method}
            onValueChange={(value) =>
              onChange(tender.key, { method: value as TenderMethod })
            }
          >
            <SelectTrigger id={`tenderMethod-${index}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TENDER_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {t.treasuryOptions.methods[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`tenderAmount-${index}`}>{t.treasury.amount}</Label>
          <Input
            id={`tenderAmount-${index}`}
            value={tender.amount}
            onChange={(event) =>
              onChange(tender.key, { amount: event.target.value })
            }
            type="number"
            step="0.01"
            min="0"
            dir="ltr"
            placeholder="0.00"
          />
        </div>

        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(tender.key)}
            aria-label={t.treasury.removeTender}
          >
            <TrashIcon className="size-4" />
          </Button>
        ) : (
          <span />
        )}
      </div>

      {/* A cheque the school cannot identify is a cheque it cannot chase. */}
      {tender.method === "CHEQUE" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`chequeNumber-${index}`}>
              {t.treasury.chequeNumber}
            </Label>
            <Input
              id={`chequeNumber-${index}`}
              value={tender.chequeNumber}
              onChange={(event) =>
                onChange(tender.key, { chequeNumber: event.target.value })
              }
              dir="ltr"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`chequeDueOn-${index}`}>
              {t.treasury.chequeDueOn}
            </Label>
            <Input
              id={`chequeDueOn-${index}`}
              value={tender.chequeDueOn}
              onChange={(event) =>
                onChange(tender.key, { chequeDueOn: event.target.value })
              }
              type="date"
              dir="ltr"
            />
          </div>
          <TenderBank
            id={`tenderBank-${index}`}
            banks={banks}
            bankId={tender.bankId}
            bankName={tender.bankName}
            onChange={(patch) => onChange(tender.key, patch)}
          />
          <div className="grid gap-1.5">
            <Label htmlFor={`tenderDrawer-${index}`}>
              {t.treasury.drawerName}
            </Label>
            <Input
              id={`tenderDrawer-${index}`}
              value={tender.drawerName}
              onChange={(event) =>
                onChange(tender.key, { drawerName: event.target.value })
              }
            />
          </div>
        </div>
      ) : tender.method === "BANK_TRANSFER" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`tenderReference-${index}`}>
              {t.treasury.reference}
            </Label>
            <Input
              id={`tenderReference-${index}`}
              value={tender.reference}
              onChange={(event) =>
                onChange(tender.key, { reference: event.target.value })
              }
              dir="ltr"
            />
          </div>
          <TenderBank
            id={`tenderBankT-${index}`}
            banks={banks}
            bankId={tender.bankId}
            bankName={tender.bankName}
            onChange={(patch) => onChange(tender.key, patch)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The bank on a cheque or a virement tender.
 *
 * Not `BankPicker`: that one posts its own form fields, and a tender is one row
 * of a parallel array whose values are emitted as hidden inputs above. Same
 * behaviour though — the declared banks, and a way out for one that is not.
 */
function TenderBank({
  id,
  banks,
  bankId,
  bankName,
  onChange,
}: {
  id: string;
  banks: BankOption[];
  bankId: string;
  bankName: string;
  onChange: (patch: Partial<Tender>) => void;
}) {
  const t = useT();
  const isOther = bankId === "" && bankName !== "";

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{t.treasury.bank}</Label>
      <Select
        value={bankId !== "" ? bankId : isOther ? "__other__" : "__none__"}
        onValueChange={(value) => {
          if (value === "__other__") onChange({ bankId: "", bankName: " " });
          else if (value === "__none__") onChange({ bankId: "", bankName: "" });
          else {
            const chosen = banks.find((bank) => bank.id === value);
            // The name is written too: a receipt reprinted years later should
            // read the same even if the bank row has since been retired.
            onChange({ bankId: value, bankName: chosen?.name ?? "" });
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t.common.none}</SelectItem>
          {banks.map((bank) => (
            <SelectItem key={bank.id} value={bank.id}>
              {bank.name}
            </SelectItem>
          ))}
          <SelectItem value="__other__">{t.treasury.otherBank}</SelectItem>
        </SelectContent>
      </Select>

      {isOther ? (
        <Input
          value={bankName.trimStart()}
          onChange={(event) => onChange({ bankName: event.target.value })}
          placeholder={t.treasury.bankName}
          autoFocus
        />
      ) : null}
    </div>
  );
}
