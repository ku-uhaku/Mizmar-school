"use client";

import { BusIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
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
  driverOptions,
  permissions,
}: {
  vehicles: VehicleRow[];
  driverOptions: { id: string; label: string }[];
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

  return (
    <div className="grid gap-3">
      {permissions.canManage ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" />
            {t.transport.newVehicle}
          </Button>
        </div>
      ) : null}

      {vehicles.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BusIcon className="size-5" />}
              title={t.transport.noVehicles}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.transport.registration}</TableHead>
                  <TableHead>{t.transport.seatCount}</TableHead>
                  <TableHead>{t.transport.driverName}</TableHead>
                  <TableHead>{t.transport.insurance}</TableHead>
                  <TableHead>{t.transport.inspection}</TableHead>
                  {permissions.canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium" dir="ltr">
                          {vehicle.registration}
                        </span>
                        <Badge
                          variant={
                            vehicle.status === "ACTIVE" ? "secondary" : "outline"
                          }
                        >
                          {
                            t.transportOptions.vehicleStatuses[
                              vehicle.status as keyof typeof t.transportOptions.vehicleStatuses
                            ]
                          }
                        </Badge>
                      </div>
                      {vehicle.make ? (
                        <span className="text-muted-foreground block text-xs">
                          {vehicle.make} {vehicle.model ?? ""}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">{vehicle.seatCount}</TableCell>
                    <TableCell>
                      {vehicle.driverLabel ?? "—"}
                      {vehicle.driverPhone ? (
                        <span className="text-muted-foreground block text-xs" dir="ltr">
                          {vehicle.driverPhone}
                        </span>
                      ) : null}
                    </TableCell>
                    <ExpiryCell date={vehicle.insuranceExpiresOn} locale={locale} />
                    <ExpiryCell date={vehicle.inspectionExpiresOn} locale={locale} />
                    {permissions.canManage ? (
                      <TableCell className="text-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(vehicle)}>
                          {t.common.edit}
                        </Button>
                        {permissions.canDelete ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setRemoving(vehicle)}
                          >
                            {t.common.delete}
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {creating || editing ? (
        <VehicleDialog
          vehicle={editing}
          driverOptions={driverOptions}
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
            <AlertDialogTitle>{t.transport.deleteVehicleTitle}</AlertDialogTitle>
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
function ExpiryCell({
  date,
  locale,
}: {
  date: string | null;
  locale: ReturnType<typeof useLocale>;
}) {
  const t = useT();
  const state = expiryState(date);

  return (
    <TableCell className="whitespace-nowrap">
      {state === "UNKNOWN" ? (
        <span className="text-muted-foreground text-xs">
          {t.transport.noExpiryRecorded}
        </span>
      ) : (
        <span
          className={cn(
            "text-sm",
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
      )}
    </TableCell>
  );
}

function VehicleDialog({
  vehicle,
  driverOptions,
  onClose,
}: {
  vehicle: VehicleRow | null;
  driverOptions: { id: string; label: string }[];
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

          {vehicle ? <input type="hidden" name="id" value={vehicle.id} /> : null}

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
                defaultValue={vehicle?.registration ?? ""}
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
              <Input id="make" name="make" defaultValue={vehicle?.make ?? ""} />
            </Field>
            <Field label={t.transport.model} name="model">
              <Input id="model" name="model" defaultValue={vehicle?.model ?? ""} />
            </Field>
            <Field label={t.transport.modelYear} name="modelYear" error={errors.modelYear}>
              <Input
                id="modelYear"
                name="modelYear"
                type="number"
                dir="ltr"
                defaultValue={vehicle?.modelYear ?? ""}
              />
            </Field>
          </div>

          <Field label={t.transport.vehicleStatus} name="status">
            <Select name="status" defaultValue={vehicle?.status ?? "ACTIVE"}>
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
          {driverOptions.length > 0 ? (
            <div className="grid gap-1.5">
              <Field label={t.transport.driverStaff} name="driverId">
                <Select
                  name="driverId"
                  defaultValue={vehicle?.driverId ?? "__none__"}
                >
                  <SelectTrigger id="driverId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t.transport.driverExternal}
                    </SelectItem>
                    {driverOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                defaultValue={vehicle?.driverName ?? ""}
              />
            </Field>
            <Field label={t.transport.driverPhone} name="driverPhone">
              <Input
                id="driverPhone"
                name="driverPhone"
                dir="ltr"
                defaultValue={vehicle?.driverPhone ?? ""}
              />
            </Field>
          </div>

          <Field label={t.transport.transportOf} name="notes">
            <Textarea id="notes" name="notes" rows={2} defaultValue={vehicle?.notes ?? ""} />
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
