"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  BusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import type { FacetDef } from "@/components/data-table/data-table-facet";
import { Combobox } from "@/components/form/combobox";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useLocale, useT } from "@/components/providers/i18n-provider";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteVehicleAction,
  saveVehicleAction,
} from "@/modules/transport/actions";
import { VEHICLE_STATUSES, expiryState } from "@/modules/transport/enums";
import { Field } from "@/modules/transport/components/field";
import type { VehicleRow } from "@/modules/transport/queries";

/** The buses themselves, and the paperwork that keeps them on the road. */
export function FleetList({
  vehicles,
  crewOptions,
  permissions,
}: {
  vehicles: VehicleRow[];
  crewOptions: { id: string; label: string }[];
  permissions: { canManage: boolean; canDelete: boolean };
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<VehicleRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<VehicleRow | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function confirmDelete() {
    if (!removing) return;
    startTransition(async () => {
      const result = await deleteVehicleAction(removing.id);
      if (result.status === "success") toast.success(result.message ?? "");
      else toast.error(result.message ?? t.errors.unexpected);
      setRemoving(null);
    });
  }

  const columns = React.useMemo<ColumnDef<VehicleRow, unknown>[]>(() => {
    const list: ColumnDef<VehicleRow, unknown>[] = [
      {
        id: "registration",
        accessorFn: (row) =>
          `${row.registration} ${row.make ?? ""} ${row.model ?? ""}`,
        header: t.transport.registration,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium" dir="ltr">
              {row.original.registration}
            </p>
            {row.original.make ? (
              <p className="text-muted-foreground truncate text-xs">
                {row.original.make} {row.original.model ?? ""}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t.transport.vehicleStatus,
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "ACTIVE" ? "secondary" : "outline"}
          >
            {
              t.transportOptions.vehicleStatuses[
                row.original
                  .status as keyof typeof t.transportOptions.vehicleStatuses
              ]
            }
          </Badge>
        ),
      },
      {
        accessorKey: "seatCount",
        header: t.transport.seatCount,
        meta: { className: "text-end" },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.seatCount}</span>
        ),
      },
      {
        // The crew in one column: the pair is what somebody wants when a bus
        // has not arrived, and two columns for two names would push the expiry
        // dates — the reason this screen exists — off a narrow table.
        id: "driver",
        accessorFn: (row) => row.driverLabel ?? "",
        header: t.transport.driverName,
        meta: { className: "hidden @2xl/table:table-cell" },
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">
              {row.original.driverLabel ?? "—"}
            </p>
            {row.original.driverPhone ? (
              <p className="text-muted-foreground truncate text-xs" dir="ltr">
                {row.original.driverPhone}
              </p>
            ) : null}
            {row.original.attendantLabel ? (
              <p className="text-muted-foreground truncate text-xs">
                {t.transport.attendantShort}: {row.original.attendantLabel}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        // Sorted on the raw date so "what expires next" is one click, while the
        // cell shows how close it is. Nulls sort last — a bus with no date
        // recorded is not urgent, it is unknown.
        accessorKey: "insuranceExpiresOn",
        header: t.transport.insurance,
        meta: { className: "hidden @3xl/table:table-cell" },
        cell: ({ row }) => (
          <ExpiryValue date={row.original.insuranceExpiresOn} locale={locale} />
        ),
      },
      {
        accessorKey: "inspectionExpiresOn",
        header: t.transport.inspection,
        meta: { className: "hidden @4xl/table:table-cell" },
        cell: ({ row }) => (
          <ExpiryValue
            date={row.original.inspectionExpiresOn}
            locale={locale}
          />
        ),
      },
    ];

    if (permissions.canManage) {
      list.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
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
                <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                  <PencilIcon />
                  {t.common.edit}
                </DropdownMenuItem>
                {permissions.canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setRemoving(row.original)}
                    >
                      <Trash2Icon />
                      {t.common.delete}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      });
    }

    return list;
  }, [t, locale, permissions.canManage, permissions.canDelete]);

  const facets = React.useMemo<FacetDef[]>(
    () => [
      {
        columnId: "status",
        label: t.transport.vehicleStatus,
        options: VEHICLE_STATUSES.map((status) => ({
          value: status,
          label: t.transportOptions.vehicleStatuses[status],
        })),
      },
    ],
    [t],
  );

  const newButton = permissions.canManage ? (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon />
      {t.transport.newVehicle}
    </Button>
  ) : undefined;

  return (
    <div className="grid gap-3">
      <DataTable
        columns={columns}
        data={vehicles}
        facets={facets}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={<BusIcon className="size-5" />}
            title={t.transport.noVehicles}
            action={newButton}
          />
        }
        toolbar={newButton}
      />

      {creating || editing ? (
        <VehicleDialog
          vehicle={editing}
          crewOptions={crewOptions}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.transport.deleteVehicleTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(t.transport.deleteVehicleBody, {
                name: removing?.registration ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={isPending}
            >
              {t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A compliance date, coloured by how close it is. */
function ExpiryValue({
  date,
  locale,
}: {
  date: string | null;
  locale: ReturnType<typeof useLocale>;
}) {
  const t = useT();
  const state = expiryState(date);

  if (state === "UNKNOWN") {
    return (
      <span className="text-muted-foreground text-xs">
        {t.transport.noExpiryRecorded}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-sm whitespace-nowrap",
        state === "EXPIRED" && "text-destructive font-medium",
        state === "SOON" && "text-destructive",
      )}
    >
      {formatDate(date, locale)}
      {state !== "OK" ? (
        <Badge variant="outline" className="ms-2 text-destructive">
          <TriangleAlertIcon className="size-3" />
          {state === "EXPIRED" ? t.transport.expired : t.transport.expiringSoon}
        </Badge>
      ) : null}
    </span>
  );
}

function VehicleDialog({
  vehicle,
  crewOptions,
  onClose,
}: {
  vehicle: VehicleRow | null;
  crewOptions: { id: string; label: string }[];
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveVehicleAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  const dateValue = (value: string | null) => (value ? value.slice(0, 10) : "");

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {vehicle ? t.transport.editVehicle : t.transport.newVehicle}
            </DialogTitle>
            <DialogDescription>{t.transport.complianceHint}</DialogDescription>
          </DialogHeader>

          {vehicle ? (
            <input type="hidden" name="id" value={vehicle.id} />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t.transport.registration}
              name="registration"
              error={errors.registration}
              required
            >
              <Input
                id="registration"
                name="registration"
                defaultValue={valueOf(
                  state,
                  "registration",
                  vehicle?.registration,
                )}
                dir="ltr"
                placeholder="12345-A-6"
                required
              />
            </Field>
            <Field
              label={t.transport.seatCount}
              name="seatCount"
              error={errors.seatCount}
              required
            >
              <Input
                id="seatCount"
                name="seatCount"
                type="number"
                min="1"
                dir="ltr"
                defaultValue={vehicle?.seatCount ?? 30}
                required
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.transport.make} name="make">
              <Input
                id="make"
                name="make"
                defaultValue={valueOf(state, "make", vehicle?.make)}
              />
            </Field>
            <Field label={t.transport.model} name="model">
              <Input
                id="model"
                name="model"
                defaultValue={valueOf(state, "model", vehicle?.model)}
              />
            </Field>
            <Field
              label={t.transport.modelYear}
              name="modelYear"
              error={errors.modelYear}
            >
              <Input
                id="modelYear"
                name="modelYear"
                type="number"
                dir="ltr"
                defaultValue={valueOf(
                  state,
                  "modelYear",
                  vehicle?.modelYear === null ||
                    vehicle?.modelYear === undefined
                    ? ""
                    : String(vehicle.modelYear),
                )}
              />
            </Field>
          </div>

          <Field label={t.transport.vehicleStatus} name="status">
            <Select
              name="status"
              defaultValue={
                valueOf(state, "status", vehicle?.status) || "ACTIVE"
              }
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t.transportOptions.vehicleStatuses[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.insurance} name="insuranceExpiresOn">
              <Input
                id="insuranceExpiresOn"
                name="insuranceExpiresOn"
                type="date"
                dir="ltr"
                defaultValue={dateValue(vehicle?.insuranceExpiresOn ?? null)}
              />
            </Field>
            <Field label={t.transport.inspection} name="inspectionExpiresOn">
              <Input
                id="inspectionExpiresOn"
                name="inspectionExpiresOn"
                type="date"
                dir="ltr"
                defaultValue={dateValue(vehicle?.inspectionExpiresOn ?? null)}
              />
            </Field>
          </div>

          {/* A school's buses are as often a contractor's as its own, so the
              employee picker and the free-text name both stay — see the note on
              Vehicle.driverId. */}
          {crewOptions.length > 0 ? (
            <div className="grid gap-1.5">
              <Field label={t.transport.driverStaff} name="driverId">
                <Combobox
                  id="driverId"
                  name="driverId"
                  defaultValue={
                    valueOf(state, "driverId", vehicle?.driverId) || "__none__"
                  }
                  emptyOption={{
                    value: "__none__",
                    label: t.transport.driverExternal,
                  }}
                  options={crewOptions.map((option) => ({
                    value: option.id,
                    label: option.label,
                  }))}
                />
              </Field>
              <p className="text-muted-foreground text-xs">
                {t.transport.driverStaffHint}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.driverName} name="driverName">
              <Input
                id="driverName"
                name="driverName"
                defaultValue={valueOf(state, "driverName", vehicle?.driverName)}
              />
            </Field>
            <Field label={t.transport.driverPhone} name="driverPhone">
              <Input
                id="driverPhone"
                name="driverPhone"
                dir="ltr"
                defaultValue={valueOf(
                  state,
                  "driverPhone",
                  vehicle?.driverPhone,
                )}
              />
            </Field>
          </div>

          {/* L'accompagnateur, on the same pattern and for the same reason —
              the person who takes the appel at the kerb is as often a
              contractor's as the school's. See Vehicle.attendantId. */}
          {crewOptions.length > 0 ? (
            <div className="grid gap-1.5">
              <Field label={t.transport.attendantStaff} name="attendantId">
                <Combobox
                  id="attendantId"
                  name="attendantId"
                  defaultValue={
                    valueOf(state, "attendantId", vehicle?.attendantId) ||
                    "__none__"
                  }
                  emptyOption={{
                    value: "__none__",
                    label: t.transport.attendantNone,
                  }}
                  options={crewOptions.map((option) => ({
                    value: option.id,
                    label: option.label,
                  }))}
                />
              </Field>
              <p className="text-muted-foreground text-xs">
                {t.transport.attendantStaffHint}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.attendantName} name="attendantName">
              <Input
                id="attendantName"
                name="attendantName"
                defaultValue={valueOf(
                  state,
                  "attendantName",
                  vehicle?.attendantName,
                )}
              />
            </Field>
            <Field label={t.transport.attendantPhone} name="attendantPhone">
              <Input
                id="attendantPhone"
                name="attendantPhone"
                dir="ltr"
                defaultValue={valueOf(
                  state,
                  "attendantPhone",
                  vehicle?.attendantPhone,
                )}
              />
            </Field>
          </div>

          <Field label={t.transport.transportOf} name="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={valueOf(state, "notes", vehicle?.notes)}
            />
          </Field>

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
