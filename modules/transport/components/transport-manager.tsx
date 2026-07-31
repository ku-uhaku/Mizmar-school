"use client";

import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, formatDate, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteRouteAction,
  deleteVehicleAction,
  saveRouteAction,
  saveVehicleAction,
  saveZoneAction,
} from "@/modules/transport/actions";
import { centimesToDirhams } from "@/modules/treasury/enums";
import {
  TRANSPORT_DIRECTIONS,
  VEHICLE_STATUSES,
  expiryState,
} from "@/modules/transport/enums";
import type {
  RouteRow,
  TransportSummary,
  VehicleRow,
  ZoneRow,
} from "@/modules/transport/queries";

/**
 * The transport screen: what the school runs, where it runs, and what it costs.
 *
 * Three tabs rather than three pages, because they are read together — a line is
 * drawn, a bus is put on it, and the zone its stops sit in decides the price.
 * Splitting them across routes would make setting up a year a tour of the
 * sidebar.
 */
export function TransportManager({
  summary,
  routes,
  vehicles,
  zones,
  vehicleOptions,
  permissions,
}: {
  summary: TransportSummary;
  routes: RouteRow[];
  vehicles: VehicleRow[];
  zones: ZoneRow[];
  vehicleOptions: { id: string; label: string; seatCount: number }[];
  permissions: { canManage: boolean; canDelete: boolean };
}) {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t.transport.linesRunning} value={String(summary.routeCount)} />
        <Stat label={t.transport.ridersTotal} value={String(summary.riderCount)} />
        <Stat
          label={t.transport.seatsFree}
          value={String(summary.seatsRemaining)}
          hint={interpolate("{offered}", { offered: summary.seatsOffered })}
        />
        <Stat
          label={t.transport.paperworkDue}
          value={String(summary.paperworkDue)}
          tone={summary.paperworkDue > 0 ? "bad" : undefined}
        />
      </div>

      <Tabs defaultValue="routes">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="routes">
            {t.transport.routes}
            {routes.length > 0 ? (
              <Badge variant="secondary" className="ms-1.5 tabular-nums">
                {routes.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="fleet">
            {t.transport.fleet}
            {vehicles.length > 0 ? (
              <Badge variant="secondary" className="ms-1.5 tabular-nums">
                {vehicles.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="zones">{t.transport.zones}</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <RoutesTab
            routes={routes}
            vehicleOptions={vehicleOptions}
            permissions={permissions}
          />
        </TabsContent>

        <TabsContent value="fleet">
          <FleetTab vehicles={vehicles} permissions={permissions} locale={locale} />
        </TabsContent>

        <TabsContent value="zones">
          <ZonesTab zones={zones} canManage={permissions.canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "bad";
}) {
  return (
    <Card>
      <CardContent className="grid gap-1 py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums",
            tone === "bad" && "text-destructive",
          )}
        >
          {value}
        </p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

// ── Lines ────────────────────────────────────────────────────────────────────

function RoutesTab({
  routes,
  vehicleOptions,
  permissions,
}: {
  routes: RouteRow[];
  vehicleOptions: { id: string; label: string; seatCount: number }[];
  permissions: { canManage: boolean; canDelete: boolean };
}) {
  const t = useT();
  const [editing, setEditing] = React.useState<RouteRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<RouteRow | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function confirmDelete() {
    if (!removing) return;
    startTransition(async () => {
      const result = await deleteRouteAction(removing.id);
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
            {t.transport.newRoute}
          </Button>
        </div>
      ) : null}

      {routes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BusIcon className="size-5" />}
              title={t.transport.noRoutes}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {routes.map((route) => (
            <Card key={route.id}>
              <CardContent className="grid gap-3 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/transport/${route.id}`}
                      className="font-medium hover:underline"
                    >
                      {route.code} · {route.name}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {route.vehicleRegistration ?? t.transport.noVehicleAssigned}
                      {route.driverName ? ` · ${route.driverName}` : ""}
                    </p>
                  </div>
                  <Badge variant={route.isActive ? "secondary" : "outline"}>
                    {
                      t.transportOptions.directions[
                        route.direction as keyof typeof t.transportOptions.directions
                      ]
                    }
                  </Badge>
                </div>

                {/* A line with no bus offers no seats — say so rather than
                    showing a confident "0 free". */}
                {route.seats === 0 ? (
                  <p className="text-destructive text-xs">
                    {t.transport.unassignedWarning}
                  </p>
                ) : (
                  <div className="grid gap-1.5">
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>
                        {route.taken} / {route.seats} {t.transport.seats}
                      </span>
                      <span>
                        {route.remaining} {t.transport.remaining}
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          route.remaining === 0 ? "bg-destructive" : "bg-primary",
                        )}
                        style={{
                          width: `${Math.min(100, (route.taken / Math.max(1, route.seats)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <p className="text-muted-foreground text-xs">
                  {route.stopCount} {t.transport.stops}
                </p>

                {permissions.canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(route)}>
                      {t.common.edit}
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/transport/${route.id}`}>{t.transport.stops}</Link>
                    </Button>
                    {permissions.canDelete ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setRemoving(route)}
                      >
                        {t.common.delete}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating || editing ? (
        <RouteDialog
          route={editing}
          vehicleOptions={vehicleOptions}
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
            <AlertDialogTitle>{t.transport.deleteRouteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(t.transport.deleteRouteBody, {
                name: removing ? `${removing.code} · ${removing.name}` : "",
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

function RouteDialog({
  route,
  vehicleOptions,
  onClose,
}: {
  route: RouteRow | null;
  vehicleOptions: { id: string; label: string; seatCount: number }[];
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveRouteAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {route ? t.transport.editRoute : t.transport.newRoute}
            </DialogTitle>
            <DialogDescription>{t.transport.capacityHint}</DialogDescription>
          </DialogHeader>

          {route ? <input type="hidden" name="id" value={route.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.routeCode} name="code" error={errors.code} required>
              <Input id="code" name="code" defaultValue={route?.code ?? ""} required />
            </Field>
            <Field label={t.transport.routeName} name="name" error={errors.name} required>
              <Input id="name" name="name" defaultValue={route?.name ?? ""} required />
            </Field>
          </div>

          <Field label={t.transport.direction} name="direction">
            <Select name="direction" defaultValue={route?.direction ?? "BOTH"}>
              <SelectTrigger id="direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_DIRECTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t.transportOptions.directions[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.assignedVehicle} name="vehicleId">
              <Select name="vehicleId" defaultValue={route?.vehicleId ?? "__none__"}>
                <SelectTrigger id="vehicleId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.common.none}</SelectItem>
                  {vehicleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label} ({option.seatCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t.transport.capacity} name="capacity" error={errors.capacity}>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min="0"
                dir="ltr"
                defaultValue={route?.seats && route.vehicleId === null ? route.seats : ""}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="isActive">{t.common.active}</Label>
            <Switch id="isActive" name="isActive" defaultChecked={route?.isActive ?? true} />
          </div>

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

// ── Fleet ────────────────────────────────────────────────────────────────────

function FleetTab({
  vehicles,
  permissions,
  locale,
}: {
  vehicles: VehicleRow[];
  permissions: { canManage: boolean; canDelete: boolean };
  locale: ReturnType<typeof useLocale>;
}) {
  const t = useT();
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
                      {vehicle.driverName ?? "—"}
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
  onClose,
}: {
  vehicle: VehicleRow | null;
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

// ── Zones ────────────────────────────────────────────────────────────────────

function ZonesTab({ zones, canManage }: { zones: ZoneRow[]; canManage: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<ZoneRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t.transport.zonesHint}</p>
        {canManage ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" />
            {t.transport.newZone}
          </Button>
        ) : null}
      </div>

      {zones.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {t.transport.noZones}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.transport.zone}</TableHead>
                  <TableHead className="text-end">{t.transport.zonePrice}</TableHead>
                  <TableHead className="text-end">{t.transport.stops}</TableHead>
                  <TableHead className="text-end">{t.transport.riders}</TableHead>
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell>
                      <span className="font-medium">{zone.name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {zone.code}
                      </span>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatAmount(zone.amountCentimes, locale)} MAD
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {zone.stopCount}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {zone.riderCount}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(zone)}>
                          {t.common.edit}
                        </Button>
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
        <ZoneDialog
          zone={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ZoneDialog({ zone, onClose }: { zone: ZoneRow | null; onClose: () => void }) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveZoneAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{zone ? t.transport.editZone : t.transport.newZone}</DialogTitle>
            <DialogDescription>{t.transport.zonesHint}</DialogDescription>
          </DialogHeader>

          {zone ? <input type="hidden" name="id" value={zone.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.routeCode} name="code" error={errors.code} required>
              <Input id="code" name="code" defaultValue={zone?.code ?? ""} required />
            </Field>
            <Field label={t.transport.routeName} name="name" error={errors.name} required>
              <Input id="name" name="name" defaultValue={zone?.name ?? ""} required />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.zonePrice} name="amount" error={errors.amount} required>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={
                  zone ? centimesToDirhams(zone.amountCentimes).toFixed(2) : ""
                }
                required
              />
            </Field>
            <Field label={t.transport.position} name="position">
              <Input
                id="position"
                name="position"
                type="number"
                min="0"
                dir="ltr"
                defaultValue={zone?.position ?? 0}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="isActive">{t.common.active}</Label>
            <Switch id="isActive" name="isActive" defaultChecked={zone?.isActive ?? true} />
          </div>

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

/** Label + control + error, the shape every dialog field in this file uses. */
export function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? (
          <span className="text-destructive ms-1" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-muted-foreground ms-1 text-xs">
            {t.common.optional}
          </span>
        )}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
