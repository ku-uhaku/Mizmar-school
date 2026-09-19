"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2Icon, PrinterIcon, SendIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { toastError } from "@/components/form/toast-error";
import { FormField } from "@/components/form/form-field";
import { DataTable } from "@/components/data-table/data-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { sendRemindersAction } from "@/modules/messaging/actions";
import { MAX_TEMPLATE_LENGTH } from "@/modules/messaging/enums";
import {
  matchesFilters,
  NO_FILTERS,
  type ReminderFilters,
} from "@/modules/messaging/filters";
import type { ReminderRow, ReminderScreen } from "@/modules/messaging/queries";
import { renderTemplate, unknownVariables } from "@/modules/messaging/template";

const ALL = "__all";

/**
 * The reminders screen: pick who, write what, send.
 *
 * ── What the browser decides, and what it does not ───────────────────────────
 * It narrows the list with `matchesFilters` and can leave households out. What
 * it submits is that *narrowing* — the filters and the left-out ids — and the
 * server derives the recipients again from the same function. Nothing the
 * manager ticks here can add a household the server did not itself offer.
 *
 * The table's own search box only helps find a row to leave out; who is sent to
 * is decided by the filters above it and the exclusions, and the summary line
 * says how many that is.
 */
export function ReminderComposer({ screen }: { screen: ReminderScreen }) {
  const { t, locale } = useI18n();
  const m = t.messaging;

  const [filters, setFilters] = React.useState<ReminderFilters>(NO_FILTERS);
  const [minAmount, setMinAmount] = React.useState("");
  const [excluded, setExcluded] = React.useState<Set<string>>(new Set());
  const [template, setTemplate] = React.useState<string>(
    m.compose.defaultTemplate,
  );
  const [remark, setRemark] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const money = React.useCallback(
    (centimes: number) => formatMoney(centimes, locale, screen.currencyCode),
    [locale, screen.currencyCode],
  );

  const visible = React.useMemo(
    () => screen.rows.filter((row) => matchesFilters(row, filters)),
    [screen.rows, filters],
  );
  const recipients = visible.filter(
    (row) => row.skip === null && !excluded.has(row.familyId),
  );
  const skipped = visible.length - recipients.length;
  const overdueTotal = recipients.reduce(
    (sum, row) => sum + row.overdueCentimes,
    0,
  );

  const sample = recipients[0] ?? visible[0] ?? null;
  const preview = sample
    ? renderTemplate(template, {
        parent: sample.contactName,
        famille: sample.familyName,
        montant: money(sample.overdueCentimes),
        enfants: sample.childNames.join(", "),
        ecole: screen.schoolName,
        remarque: remark,
      })
    : "";
  const unknown = unknownVariables(template);

  const short = recipients.length > screen.balance;
  const blocked =
    screen.gateway === "UNCONFIGURED" ||
    recipients.length === 0 ||
    short ||
    template.trim() === "" ||
    template.length > MAX_TEMPLATE_LENGTH ||
    screen.activeCampaignId !== null;

  const setFilter = (patch: Partial<ReminderFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const toggle = React.useCallback((familyId: string) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (!next.delete(familyId)) next.add(familyId);
      return next;
    });
  }, []);

  const printHref = `/print/relances?${new URLSearchParams({
    template,
    remark,
    filters: JSON.stringify(filters),
    excluded: [...excluded].join(","),
  }).toString()}`;

  function send() {
    startTransition(async () => {
      const result = await sendRemindersAction({
        template,
        remark,
        filters,
        excludedFamilyIds: [...excluded],
      });
      setConfirming(false);
      if (result.status === "success") toast.success(result.message);
      else toastError(result.message ?? t.errors.unexpected);
    });
  }

  const columns = React.useMemo<ColumnDef<ReminderRow, unknown>[]>(
    () => [
      {
        id: "family",
        accessorFn: (row) =>
          `${row.familyName} ${row.familyCode} ${row.contactName}`,
        header: m.columns.family,
        cell: ({ row }) => (
          <Link
            href={`/families/${row.original.familyId}`}
            className="hover:text-primary block min-w-0"
          >
            <p className="truncate text-sm font-medium">
              {row.original.familyName}
            </p>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {row.original.familyCode}
            </p>
          </Link>
        ),
      },
      {
        id: "contact",
        accessorFn: (row) => row.contactName,
        header: m.columns.contact,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.contactName}</p>
            <p className="text-muted-foreground truncate text-xs" dir="ltr">
              {row.original.phone
                ? `+${row.original.phone}`
                : (row.original.contactPhone ?? "—")}
            </p>
          </div>
        ),
      },
      {
        id: "overdue",
        accessorFn: (row) => row.overdueCentimes,
        header: m.columns.overdue,
        cell: ({ row }) => (
          <span className="text-destructive text-sm font-medium tabular-nums">
            {money(row.original.overdueCentimes)}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) =>
          row.skip ?? (excluded.has(row.familyId) ? "LEFT_OUT" : "SEND"),
        header: m.columns.status,
        cell: ({ row }) => {
          const original = row.original;
          if (original.skip) {
            return <Badge variant="outline">{m.skip[original.skip]}</Badge>;
          }
          return excluded.has(original.familyId) ? (
            <Badge variant="outline">{m.selection.leftOut}</Badge>
          ) : (
            <Badge variant="secondary">{m.willSend}</Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.skip === null ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => toggle(row.original.familyId)}
            >
              {excluded.has(row.original.familyId)
                ? m.selection.include
                : m.selection.exclude}
            </Button>
          ) : null,
      },
    ],
    [m, money, excluded, toggle],
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Tile
          label={m.gatewayLabel}
          value={m.gateway[screen.gateway]}
          alarming={screen.gateway !== "READY"}
        />
        <Tile
          label={m.credits.label}
          value={interpolate(m.credits.left, { count: screen.balance })}
          alarming={short}
          action={
            screen.isOwner ? (
              <Link
                href="/caisse/relances/credits"
                className="text-primary text-xs hover:underline"
              >
                {m.credits.manage}
              </Link>
            ) : null
          }
        />
        <Tile label={m.willSend} value={String(recipients.length)} />
        <Tile
          label={m.columns.overdue}
          value={money(overdueTotal)}
          hint={interpolate(m.selection.skipped, { count: skipped })}
        />
      </div>

      {short ? (
        <Alert variant="destructive">
          <AlertDescription>{m.credits.contactOwner}</AlertDescription>
        </Alert>
      ) : null}

      {screen.activeCampaignId ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {m.activeCampaign}
            <Link
              href={`/caisse/relances/${screen.activeCampaignId}`}
              className="text-primary hover:underline"
            >
              {m.viewCampaign}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{m.filters.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField name="minAmount" label={m.filters.minAmount}>
            <Input
              id="minAmount"
              type="number"
              min={0}
              inputMode="decimal"
              value={minAmount}
              onChange={(event) => {
                setMinAmount(event.target.value);
                const value = Number(event.target.value);
                setFilter({
                  minCentimes:
                    Number.isFinite(value) && value > 0
                      ? Math.round(value * 100)
                      : 0,
                });
              }}
            />
          </FormField>
          <FormField name="level" label={m.filters.level}>
            <Select
              value={filters.levelOfferingId ?? ALL}
              onValueChange={(value) =>
                setFilter({ levelOfferingId: value === ALL ? null : value })
              }
            >
              <SelectTrigger id="level" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{m.filters.allLevels}</SelectItem>
                {screen.levels.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField name="class" label={m.filters.class}>
            <Select
              value={filters.classId ?? ALL}
              onValueChange={(value) =>
                setFilter({ classId: value === ALL ? null : value })
              }
            >
              <SelectTrigger id="class" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{m.filters.allClasses}</SelectItem>
                {screen.classes.map((schoolClass) => (
                  <SelectItem key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      {screen.rows.length === 0 ? (
        <EmptyState icon={<WalletIcon />} title={m.noneLate} />
      ) : (
        <DataTable
          data={visible}
          columns={columns}
          rowClassName={(row) =>
            row.skip || excluded.has(row.familyId)
              ? "text-muted-foreground"
              : undefined
          }
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{m.compose.title}</CardTitle>
          <CardDescription>{m.compose.variablesHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField
            name="template"
            label={m.compose.template}
            error={
              unknown.length > 0
                ? interpolate(m.compose.unknownVariables, {
                    names: unknown.map((name) => `{${name}}`).join(" "),
                  })
                : undefined
            }
          >
            <Textarea
              id="template"
              rows={5}
              maxLength={MAX_TEMPLATE_LENGTH}
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
            />
          </FormField>
          <FormField
            name="remark"
            label={m.compose.remark}
            hint={m.compose.remarkHint}
          >
            <Input
              id="remark"
              maxLength={500}
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
            />
          </FormField>

          {sample ? (
            <div className="bg-muted/40 rounded-lg p-4">
              <p className="text-muted-foreground mb-2 text-xs">
                {m.compose.preview} ·{" "}
                {interpolate(m.compose.previewFor, {
                  family: sample.familyName,
                })}
              </p>
              <p className="text-sm whitespace-pre-wrap">{preview}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="outline">
              <Link href={printHref} target="_blank">
                <PrinterIcon />
                {m.print}
              </Link>
            </Button>
            <Button
              onClick={() => setConfirming(true)}
              disabled={blocked || pending}
            >
              <SendIcon />
              {m.send}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.send}</AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(m.sendConfirm, { count: recipients.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                // Keep the dialog open until the action resolves.
                event.preventDefault();
                send();
              }}
            >
              {pending ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  {m.sending}
                </>
              ) : (
                m.send
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  alarming,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  alarming?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          alarming && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
