"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckIcon, FuelIcon, PlusIcon, XIcon } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useMoney } from "@/components/providers/settings-provider";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
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
import {
  formatDate,
  formatDecimal,
  formatNumber,
  interpolate,
} from "@/lib/i18n/format";
import {
  decideFuelRequestAction,
  deleteFuelRequestAction,
  saveFuelRequestAction,
} from "@/modules/transport/actions";
import {
  FUEL_REQUEST_STATUSES,
  tenthsToLitres,
} from "@/modules/transport/enums";
import { useToastedTransition } from "@/components/form/use-toasted-transition";
import type { FuelRequestRow, FuelSummary } from "@/modules/transport/queries";
import { Field } from "@/modules/transport/components/field";

const NONE = "__none__";

/** Tenths render as one decimal, always — "45,0 L" rather than "45 L". */
function litres(tenths: number, locale: Parameters<typeof formatNumber>[1]) {
  return formatDecimal(tenthsToLitres(tenths), locale);
}

/**
 * Les demandes de consommation: what the fleet has burnt, and who agreed to it.
 *
 * Raising and deciding are two buttons for two people. A driver with
 * TRANSPORT_FUEL can add a request and edit it while it is pending; only
 * TRANSPORT_FUEL_APPROVE turns one into money, and approving is what posts the
 * décaissement — see `decideFuelRequest`. Once decided a request is frozen,
 * because it is the paper behind a movement in the ledger.
 */
export function FuelList({
  requests,
  summary,
  vehicles,
  drivers,
  categories,
  permissions,
}: {
  requests: FuelRequestRow[];
  summary: FuelSummary;
  vehicles: { id: string; label: string; driverId: string | null }[];
  drivers: { id: string; label: string }[];
  /** Out-going rubriques the décaissement may be posted under. */
  categories: { id: string; label: string }[];
  permissions: { canRaise: boolean; canApprove: boolean };
}) {
  const t = useT();
  const locale = useLocale();
  const money = useMoney();
  const { isPending, run } = useToastedTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FuelRequestRow | undefined>();
  const [deleting, setDeleting] = React.useState<FuelRequestRow | null>(null);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  const decide = React.useCallback(
    (request: FuelRequestRow, status: "APPROVED" | "REJECTED") => {
      const formData = new FormData();
      formData.set("id", request.id);
      formData.set("status", status);
      // The rubrique is the school's first out-going one; a bursar who wants it
      // elsewhere re-posts in the caisse, where that decision belongs.
      if (categories[0]) formData.set("categoryId", categories[0].id);
      run(() => decideFuelRequestAction({ status: "idle" }, formData));
    },
    [categories, run],
  );

  const columns = React.useMemo<ColumnDef<FuelRequestRow, unknown>[]>(
    () => [
      {
        id: "vehicle",
        accessorFn: (row) => `${row.vehicleRegistration} ${row.requestedBy ?? ""}`,
        header: t.transport.fuelVehicle,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium" dir="ltr">
              {row.original.vehicleRegistration}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.requestedBy ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "occurredOn",
        header: t.transport.fuelDate,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDate(row.original.occurredOn, locale)}
          </span>
        ),
      },
      {
        accessorKey: "litresTenths",
        header: t.transport.fuelLitres,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums" dir="ltr">
            {interpolate(t.transport.fuelLitresValue, {
              value: litres(row.original.litresTenths, locale),
            })}
          </span>
        ),
      },
      {
        accessorKey: "amountCentimes",
        header: t.transport.fuelAmount,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {money(row.original.amountCentimes)}
          </span>
        ),
      },
      {
        id: "consumption",
        accessorFn: (row) => row.consumptionTenths ?? -1,
        header: t.transport.fuelConsumption,
        meta: { className: "text-end hidden @2xl/table:table-cell" },
        cell: ({ row }) => {
          const entry = row.original;
          // Blank, not zero: an unknown consumption and a bus that used nothing
          // are different answers — see `consumptionPer100km`.
          if (entry.consumptionTenths === null) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="grid" dir="ltr">
              <span className="tabular-nums">
                {interpolate(t.transport.fuelPerHundred, {
                  value: litres(entry.consumptionTenths, locale),
                })}
              </span>
              {entry.distanceKm !== null ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {interpolate(t.transport.fuelKilometres, {
                    value: formatNumber(entry.distanceKm, locale),
                  })}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: t.transport.fuelStatus,
        cell: ({ row }) => {
          const status = row.original
            .status as keyof typeof t.transportOptions.fuelStatuses;
          return (
            <Badge
              variant={
                row.original.status === "REJECTED"
                  ? "destructive"
                  : row.original.status === "PENDING"
                    ? "outline"
                    : "secondary"
              }
            >
              {t.transportOptions.fuelStatuses[status]}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const request = row.original;
          if (request.status !== "PENDING") return null;

          return (
            <div className="flex justify-end gap-1">
              {permissions.canApprove ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => decide(request, "APPROVED")}
                  >
                    <CheckIcon />
                    {t.transport.fuelApprove}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => decide(request, "REJECTED")}
                  >
                    <XIcon />
                    {t.transport.fuelReject}
                  </Button>
                </>
              ) : null}
              {permissions.canRaise ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(request);
                    setDialogOpen(true);
                  }}
                >
                  {t.common.edit}
                </Button>
              ) : null}
              {permissions.canApprove ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleting(request)}
                >
                  {t.common.delete}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, locale, money, isPending, decide, permissions],
  );

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "status",
        label: t.transport.fuelStatus,
        options: FUEL_REQUEST_STATUSES.map((status) => ({
          value: status,
          label: t.transportOptions.fuelStatuses[status],
        })),
      },
    ],
    [t],
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Summary
          label={t.transport.fuelPending}
          value={String(summary.pendingCount)}
          hint={money(summary.pendingCentimes)}
        />
        <Summary
          label={t.transport.fuelRecent}
          value={money(summary.recentCentimes)}
          hint={interpolate(t.transport.fuelLitresValue, {
            value: litres(summary.recentLitresTenths, locale),
          })}
        />
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<FuelIcon className="size-5" />}
              title={t.transport.noFuelRequests}
              description={t.transport.noFuelRequestsHint}
              action={
                permissions.canRaise && vehicles.length > 0 ? (
                  <Button size="sm" onClick={openCreate}>
                    <PlusIcon />
                    {t.transport.newFuelRequest}
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={requests}
          facets={facets}
          searchPlaceholder={t.transport.fuelVehicle}
          toolbar={
            permissions.canRaise && vehicles.length > 0 ? (
              <Button size="sm" onClick={openCreate}>
                <PlusIcon />
                {t.transport.newFuelRequest}
              </Button>
            ) : undefined
          }
        />
      )}

      {permissions.canRaise ? (
        <FuelDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          request={editing}
          vehicles={vehicles}
          drivers={drivers}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t.transport.fuelDeleteTitle}
          description={t.transport.fuelDeleteBody}
          action={() => deleteFuelRequestAction(deleting.id)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="grid gap-1 py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs tabular-nums">{hint}</p>
      </CardContent>
    </Card>
  );
}

function FuelDialog({
  open,
  onOpenChange,
  request,
  vehicles,
  drivers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: FuelRequestRow;
  vehicles: { id: string; label: string; driverId: string | null }[];
  drivers: { id: string; label: string }[];
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveFuelRequestAction, IDLE);
  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  const errors = state.fieldErrors ?? {};

  // Picking the bus fills in whoever drives it — a shortcut, not a binding: the
  // caretaker who took the minibus on Wednesday can still be typed over.
  const [vehicleId, setVehicleId] = React.useState(
    request?.vehicleId ?? vehicles[0]?.id ?? "",
  );
  const vehicle = vehicles.find((entry) => entry.id === vehicleId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {request ? t.transport.editFuelRequest : t.transport.newFuelRequest}
          </DialogTitle>
          <DialogDescription>{t.transport.fuelSubtitle}</DialogDescription>
        </DialogHeader>

        {/* Remounted per request so the inputs start from that row's figures
          rather than the previously opened one's. */}
        <form
          key={request?.id ?? "new"}
          action={formAction}
          className="grid gap-4"
        >
          {request ? (
            <input type="hidden" name="id" value={request.id} />
          ) : null}

          <Field
            label={t.transport.fuelVehicle}
            name="vehicleId"
            error={errors.vehicleId}
            required
          >
            <Select
              name="vehicleId"
              value={vehicleId}
              onValueChange={setVehicleId}
            >
              <SelectTrigger id="vehicleId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t.transport.fuelDriver} name="requestedById">
            <Select
              name="requestedById"
              // Keyed on the bus so the default follows a change of bus.
              key={vehicle?.driverId ?? "none"}
              defaultValue={vehicle?.driverId ?? NONE}
            >
              <SelectTrigger id="requestedById" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.common.none}</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t.transport.fuelDriverName} name="requestedByName">
            <Input
              id="requestedByName"
              name="requestedByName"
              maxLength={120}
              defaultValue={valueOf(state, "requestedByName", null)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.transport.fuelDate}
              name="occurredOn"
              error={errors.occurredOn}
            >
              <Input
                id="occurredOn"
                name="occurredOn"
                type="date"
                dir="ltr"
                defaultValue={
                  valueOf(
                    state,
                    "occurredOn",
                    request?.occurredOn.slice(0, 10),
                  ) || new Date().toISOString().slice(0, 10)
                }
              />
            </Field>

            <Field
              label={t.transport.fuelOdometer}
              name="odometerKm"
              error={errors.odometerKm}
            >
              <Input
                id="odometerKm"
                name="odometerKm"
                type="number"
                min={0}
                dir="ltr"
                className="tabular-nums"
                defaultValue={valueOf(
                  state,
                  "odometerKm",
                  request?.odometerKm !== null && request?.odometerKm !== undefined
                    ? String(request.odometerKm)
                    : null,
                )}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.transport.fuelLitres}
              name="litres"
              error={errors.litres}
              required
            >
              <Input
                id="litres"
                name="litres"
                type="number"
                min={0}
                step="0.1"
                dir="ltr"
                className="tabular-nums"
                defaultValue={valueOf(
                  state,
                  "litres",
                  request ? String(tenthsToLitres(request.litresTenths)) : null,
                )}
              />
            </Field>

            <Field
              label={t.transport.fuelAmount}
              name="amount"
              error={errors.amount}
              required
            >
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0}
                step="0.01"
                dir="ltr"
                className="tabular-nums"
                defaultValue={valueOf(
                  state,
                  "amount",
                  request ? String(request.amountCentimes / 100) : null,
                )}
              />
            </Field>
          </div>

          <Field label={t.transport.riderNotes} name="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={valueOf(state, "notes", request?.notes)}
            />
          </Field>

          <DialogFooter>
            <SubmitButton>{t.common.save}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
