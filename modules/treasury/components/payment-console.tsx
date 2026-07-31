"use client";

import { PlusIcon, TrashIcon, WalletIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { FormField, controlProps } from "@/components/form/form-field";
import { FormActions, FormSection } from "@/components/form/form-page";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
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
import { formatAmount, formatMonth, toDateInputValue } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { recordPaymentAction } from "@/modules/treasury/actions";
import {
  TENDER_METHODS,
  centimesToDirhams,
  dirhamsToCentimes,
  type TenderMethod,
} from "@/modules/treasury/enums";
import type {
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
  /** Null when no till is open — cash cannot be taken, and the screen says so. */
  hasOpenSession: boolean;
};

type Tender = {
  key: string;
  method: TenderMethod;
  amount: string;
  reference: string;
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
    bankName: "",
    chequeNumber: "",
    chequeDueOn: "",
    drawerName: "",
  };
}

/** Groups a child's charges into the month they fall due in. */
function byMonth(lines: PayableLine[]) {
  const months = new Map<string, { year: number; month: number; lines: PayableLine[] }>();

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

  return Array.from(months.entries()).map(([key, value]) => ({ key, ...value }));
}

export function PaymentConsole({ families, family, hasOpenSession }: Props) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [state, formAction] = React.useActionState(recordPaymentAction, IDLE);
  useActionFeedback(state, {
    onSuccess: () => {
      setSelection({});
      setTenders([emptyTender()]);
      router.refresh();
    },
  });

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
    <form action={formAction} className="grid gap-5">
      <FormSection
        title={t.treasury.family}
        description={t.treasury.selectFamilyHint}
      >
        <FormField name="familyId" label={t.treasury.selectFamily}>
          <Select
            value={family?.familyId ?? ""}
            // Navigating rather than fetching: the payable schedule is a
            // permission-scoped server read, and the URL then survives a reload.
            onValueChange={(value) => router.push(`/caisse/encaissement?family=${value}`)}
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
                {money(family.outstandingCentimes)} MAD
              </span>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectEverything}>
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
                  {t.treasury.owes}: {money(child.outstandingCentimes)} MAD
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

          <FormSection title={t.treasury.tenders} description={t.treasury.tendersHint}>
            <div className="grid gap-4">
              {tenders.map((tender, index) => (
                <TenderRow
                  key={tender.key}
                  tender={tender}
                  index={index}
                  canRemove={tenders.length > 1}
                  onChange={updateTender}
                  onRemove={(key) =>
                    setTenders((current) =>
                      current.filter((entry) => entry.key !== key),
                    )
                  }
                  t={t}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTenders((current) => [...current, emptyTender("CHEQUE")])}
              >
                <PlusIcon className="size-4" />
                {t.treasury.addTender}
              </Button>
              {selectedTotalCentimes !== tenderTotalCentimes ? (
                <Button type="button" variant="ghost" size="sm" onClick={matchSelection}>
                  {t.treasury.payFull}
                </Button>
              ) : null}
            </div>

            <Separator />

            <FormField name="paidAt" label={t.treasury.paidAt}>
              <Input
                {...controlProps("paidAt", state.fieldErrors?.paidAt)}
                type="date"
                defaultValue={toDateInputValue(new Date())}
                dir="ltr"
              />
            </FormField>

            <FormField name="notes" label={t.treasury.notes}>
              <Textarea {...controlProps("notes")} rows={2} />
            </FormField>
          </FormSection>

          <Card>
            <CardContent className="grid gap-2 py-4 text-sm">
              <Row
                label={t.treasury.selected}
                value={`${money(selectedTotalCentimes)} MAD`}
              />
              <Row
                label={t.treasury.tenders}
                value={`${money(tenderTotalCentimes)} MAD`}
                tone={balanced ? "ok" : "warn"}
              />
              {!balanced && selectedTotalCentimes > 0 ? (
                <p className="text-destructive text-xs">
                  {t.treasury.tendersMustMatch}
                </p>
              ) : null}
              {takesCash && !hasOpenSession ? (
                <p className="text-destructive text-xs">
                  {t.treasury.noOpenSession}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <FormActions>
            <SubmitButton
              size="lg"
              disabled={!balanced || (takesCash && !hasOpenSession)}
            >
              <WalletIcon className="size-4" />
              {t.treasury.recordPayment}
            </SubmitButton>
          </FormActions>
        </>
      )}
    </form>
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
  t,
}: {
  title: string;
  lines: PayableLine[];
  selection: Record<string, string>;
  onToggle: (line: PayableLine, checked: boolean) => void;
  onAmountChange: (lineId: string, amount: string) => void;
  money: (centimes: number) => string;
  t: ReturnType<typeof useT>;
}) {
  const outstanding = lines.reduce(
    (total, line) => total + line.outstandingCentimes,
    0,
  );
  const settled = outstanding === 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        settled && "bg-muted/40 opacity-70",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium capitalize">{title}</p>
        <span className="text-muted-foreground text-xs tabular-nums">
          {money(outstanding)}
        </span>
      </div>

      <div className="grid gap-2">
        {lines.map((line) => {
          const checked = line.id in selection;
          const done = line.outstandingCentimes === 0;

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
                  <span className="text-muted-foreground tabular-nums">
                    {done
                      ? t.treasury.alreadyPaid
                      : `${money(line.outstandingCentimes)} MAD`}
                    {line.paidCentimes > 0 && !done
                      ? ` · ${t.treasury.alreadyPaid} ${money(line.paidCentimes)}`
                      : ""}
                  </span>
                </Label>
              </div>

              {/* Editable once ticked: part payment is ordinary. */}
              {checked ? (
                <Input
                  value={selection[line.id] ?? ""}
                  onChange={(event) => onAmountChange(line.id, event.target.value)}
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
  tender,
  index,
  canRemove,
  onChange,
  onRemove,
  t,
}: {
  tender: Tender;
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
            onChange={(event) => onChange(tender.key, { amount: event.target.value })}
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
            <Label htmlFor={`chequeNumber-${index}`}>{t.treasury.chequeNumber}</Label>
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
            <Label htmlFor={`chequeDueOn-${index}`}>{t.treasury.chequeDueOn}</Label>
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
          <div className="grid gap-1.5">
            <Label htmlFor={`tenderBank-${index}`}>{t.treasury.bankName}</Label>
            <Input
              id={`tenderBank-${index}`}
              value={tender.bankName}
              onChange={(event) => onChange(tender.key, { bankName: event.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`tenderDrawer-${index}`}>{t.treasury.drawerName}</Label>
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
            <Label htmlFor={`tenderReference-${index}`}>{t.treasury.reference}</Label>
            <Input
              id={`tenderReference-${index}`}
              value={tender.reference}
              onChange={(event) =>
                onChange(tender.key, { reference: event.target.value })
              }
              dir="ltr"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`tenderBankT-${index}`}>{t.treasury.bankName}</Label>
            <Input
              id={`tenderBankT-${index}`}
              value={tender.bankName}
              onChange={(event) => onChange(tender.key, { bankName: event.target.value })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
