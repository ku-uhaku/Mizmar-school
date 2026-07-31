"use client";

import { MapPinIcon, PlusIcon, UsersIcon } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { IDLE } from "@/lib/action-state";
import { formatAmount, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteStopAction,
  saveStopAction,
  subscribeRiderAction,
  unsubscribeRiderAction,
  updateRiderAction,
} from "@/modules/transport/actions";
import {
  SUBSCRIPTION_STATUSES,
  TRANSPORT_DIRECTIONS,
} from "@/modules/transport/enums";
import type {
  RouteDetail,
  StopRow,
  SubscribableStudent,
  ZoneRow,
} from "@/modules/transport/queries";
import { Field } from "@/modules/transport/components/field";

/**
 * One line: the stops it serves, in order, and everyone riding it.
 *
 * The stops come first because they are what the riders are chosen from — a
 * pupil is put on the bus by picking where they board, never by picking a zone,
 * so a line with no stops cannot take passengers and the screen shows why.
 */
export function RoutePanel({
  route,
  zones,
  subscribable,
  permissions,
}: {
  route: RouteDetail;
  zones: ZoneRow[];
  subscribable: SubscribableStudent[];
  permissions: { canManage: boolean; canSubscribe: boolean };
}) {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label={t.transport.assignedVehicle}
          value={route.vehicleRegistration ?? t.transport.noVehicleAssigned}
          hint={route.driverName ?? undefined} />
        <Summary
          label={t.transport.seats}
          value={`${route.taken} / ${route.seats}`}
          hint={`${route.remaining} ${t.transport.remaining}`}
          tone={route.remaining === 0 ? "bad" : undefined}
        />
        <Summary
          label={t.transport.direction}
          value={
            t.transportOptions.directions[
              route.direction as keyof typeof t.transportOptions.directions
            ]
          }
        />
      </div>

      <Tabs defaultValue="stops">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="stops">
            {t.transport.stops}
            <Badge variant="secondary" className="ms-1.5 tabular-nums">
              {route.stops.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="riders">
            {t.transport.riders}
            <Badge variant="secondary" className="ms-1.5 tabular-nums">
              {route.riders.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stops">
          <StopsTab route={route} zones={zones} canManage={permissions.canManage} />
        </TabsContent>

        <TabsContent value="riders">
          <RidersTab
            route={route}
            subscribable={subscribable}
            canSubscribe={permissions.canSubscribe}
            locale={locale}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Summary({
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
        <p className={cn("font-semibold", tone === "bad" && "text-destructive")}>
          {value}
        </p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

// ── Stops ────────────────────────────────────────────────────────────────────

function StopsTab({
  route,
  zones,
  canManage,
}: {
  route: RouteDetail;
  zones: ZoneRow[];
  canManage: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = React.useState<StopRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<StopRow | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function confirmDelete() {
    if (!removing) return;
    startTransition(async () => {
      const result = await deleteStopAction(removing.id);
      if (result.status === "success") toast.success(result.message ?? "");
      else toast.error(result.message ?? t.errors.unexpected);
      setRemoving(null);
    });
  }

  return (
    <div className="grid gap-3">
      {canManage ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" />
            {t.transport.newStop}
          </Button>
        </div>
      ) : null}

      {route.stops.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<MapPinIcon className="size-5" />}
              title={t.transport.noStops}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t.transport.position}</TableHead>
                  <TableHead>{t.transport.stopName}</TableHead>
                  <TableHead>{t.transport.zone}</TableHead>
                  <TableHead>{t.transport.pickupTime}</TableHead>
                  <TableHead className="text-end">{t.transport.riders}</TableHead>
                  {canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {route.stops.map((stop) => (
                  <TableRow key={stop.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {stop.position}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{stop.name}</span>
                      {stop.landmark ? (
                        <span className="text-muted-foreground block text-xs">
                          {stop.landmark}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {stop.zoneName ? (
                        <span className="text-sm">
                          {stop.zoneName}
                          <span className="text-muted-foreground ms-2 text-xs tabular-nums">
                            {formatAmount(stop.zoneAmountCentimes ?? 0, locale)}
                          </span>
                        </span>
                      ) : (
                        // Without a zone a rider here has no price at all.
                        <Badge variant="outline" className="text-destructive">
                          {t.transport.noZoneOnStop}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums" dir="ltr">
                      {stop.pickupTime ?? "—"}
                      {stop.dropoffTime ? ` / ${stop.dropoffTime}` : ""}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {stop.riderCount}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(stop)}>
                          {t.common.edit}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setRemoving(stop)}
                        >
                          {t.common.delete}
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
        <StopDialog
          routeId={route.id}
          stop={editing}
          zones={zones}
          nextPosition={route.stops.length}
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
            <AlertDialogTitle>{t.transport.stop}</AlertDialogTitle>
            <AlertDialogDescription>{removing?.name}</AlertDialogDescription>
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

function StopDialog({
  routeId,
  stop,
  zones,
  nextPosition,
  onClose,
}: {
  routeId: string;
  stop: StopRow | null;
  zones: ZoneRow[];
  nextPosition: number;
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(saveStopAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{stop ? t.transport.editStop : t.transport.newStop}</DialogTitle>
            <DialogDescription>{t.transport.landmarkHint}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="routeId" value={routeId} />
          {stop ? <input type="hidden" name="id" value={stop.id} /> : null}

          <Field label={t.transport.stopName} name="name" error={errors.name} required>
            <Input id="name" name="name" defaultValue={stop?.name ?? ""} required />
          </Field>

          <Field label={t.transport.landmark} name="landmark">
            <Input id="landmark" name="landmark" defaultValue={stop?.landmark ?? ""} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.zone} name="zoneId">
              <Select name="zoneId" defaultValue={stop?.zoneId ?? "__none__"}>
                <SelectTrigger id="zoneId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.common.none}</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t.transport.position} name="position">
              <Input
                id="position"
                name="position"
                type="number"
                min="0"
                dir="ltr"
                defaultValue={stop?.position ?? nextPosition}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.pickupTime} name="pickupTime" error={errors.pickupTime}>
              <Input
                id="pickupTime"
                name="pickupTime"
                dir="ltr"
                placeholder="07:30"
                defaultValue={stop?.pickupTime ?? ""}
              />
            </Field>
            <Field
              label={t.transport.dropoffTime}
              name="dropoffTime"
              error={errors.dropoffTime}
            >
              <Input
                id="dropoffTime"
                name="dropoffTime"
                dir="ltr"
                placeholder="17:00"
                defaultValue={stop?.dropoffTime ?? ""}
              />
            </Field>
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

// ── Riders ───────────────────────────────────────────────────────────────────

function RidersTab({
  route,
  subscribable,
  canSubscribe,
  locale,
}: {
  route: RouteDetail;
  subscribable: SubscribableStudent[];
  canSubscribe: boolean;
  locale: ReturnType<typeof useLocale>;
}) {
  const t = useT();
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<
    RouteDetail["riders"][number] | null
  >(null);
  const [removing, setRemoving] = React.useState<
    RouteDetail["riders"][number] | null
  >(null);
  const [isPending, startTransition] = React.useTransition();

  function confirmRemove() {
    if (!removing) return;
    startTransition(async () => {
      const result = await unsubscribeRiderAction(removing.subscriptionId);
      if (result.status === "success") toast.success(result.message ?? "");
      else toast.error(result.message ?? t.errors.unexpected);
      setRemoving(null);
    });
  }

  const canAdd =
    canSubscribe && route.stops.length > 0 && route.remaining > 0 && subscribable.length > 0;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t.transport.billingNote}</p>
        {canSubscribe ? (
          <Button size="sm" disabled={!canAdd} onClick={() => setAdding(true)}>
            <PlusIcon className="size-4" />
            {t.transport.addRider}
          </Button>
        ) : null}
      </div>

      {/* Say which of the three preconditions is missing rather than leaving a
          disabled button with no explanation. */}
      {canSubscribe && !canAdd ? (
        <p className="text-muted-foreground text-xs">
          {route.stops.length === 0
            ? t.transport.noStops
            : route.remaining === 0
              ? t.transport.routeFull
              : t.transport.noSubscribable}
        </p>
      ) : null}

      {route.riders.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<UsersIcon className="size-5" />}
              title={t.transport.noRiders}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.transport.pupil}</TableHead>
                  <TableHead>{t.transport.stop}</TableHead>
                  <TableHead>{t.transport.direction}</TableHead>
                  <TableHead>{t.transport.zone}</TableHead>
                  <TableHead className="text-end">{t.transport.pricePerYear}</TableHead>
                  {canSubscribe ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {route.riders.map((rider) => (
                  <TableRow key={rider.subscriptionId}>
                    <TableCell>
                      <span className="font-medium">{rider.studentName}</span>
                      <span className="text-muted-foreground block text-xs">
                        {rider.studentCode}
                        {rider.className ? ` · ${rider.className}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>{rider.stopName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {
                          t.transportOptions.directions[
                            rider.direction as keyof typeof t.transportOptions.directions
                          ]
                        }
                      </Badge>
                      {rider.status !== "ACTIVE" ? (
                        <Badge variant="outline" className="ms-1">
                          {
                            t.transportOptions.subscriptionStatuses[
                              rider.status as keyof typeof t.transportOptions.subscriptionStatuses
                            ]
                          }
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{rider.zoneName ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatAmount(rider.priceCentimes, locale)}
                    </TableCell>
                    {canSubscribe ? (
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(rider)}
                        >
                          {t.common.edit}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setRemoving(rider)}
                        >
                          {t.common.delete}
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

      {adding ? (
        <RiderDialog
          stops={route.stops}
          subscribable={subscribable}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {editing ? (
        <EditRiderDialog
          rider={editing}
          stops={route.stops}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.transport.removeRiderTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {interpolate(t.transport.removeRiderBody, {
                name: removing?.studentName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmRemove();
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

function RiderDialog({
  stops,
  subscribable,
  onClose,
}: {
  stops: StopRow[];
  subscribable: SubscribableStudent[];
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(subscribeRiderAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.transport.addRider}</DialogTitle>
            <DialogDescription>{t.transport.billingNote}</DialogDescription>
          </DialogHeader>

          <Field
            label={t.transport.pupil}
            name="enrollmentId"
            error={errors.enrollmentId}
            required
          >
            <Select name="enrollmentId" required>
              <SelectTrigger id="enrollmentId" className="w-full">
                <SelectValue placeholder={t.transport.pupil} />
              </SelectTrigger>
              <SelectContent>
                {subscribable.map((option) => (
                  <SelectItem key={option.enrollmentId} value={option.enrollmentId}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t.transport.stop} name="stopId" error={errors.stopId} required>
            <Select name="stopId" required>
              <SelectTrigger id="stopId" className="w-full">
                <SelectValue placeholder={t.transport.stop} />
              </SelectTrigger>
              <SelectContent>
                {stops.map((stop) => (
                  <SelectItem key={stop.id} value={stop.id}>
                    {stop.name}
                    {stop.zoneName ? ` · ${stop.zoneName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.direction} name="direction">
              <Select name="direction" defaultValue="BOTH">
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

            <Field label={t.transport.subscriptionStatus} name="status">
              <Select name="status" defaultValue="ACTIVE">
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t.transportOptions.subscriptionStatuses[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={t.transport.startsOn} name="startsOn">
            <Input id="startsOn" name="startsOn" type="date" dir="ltr" />
          </Field>

          <Field label={t.transport.transportOf} name="notes">
            <Textarea id="notes" name="notes" rows={2} />
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

/**
 * Moving a rider, changing their direction, or suspending them.
 *
 * Every one of those changes what they pay, so the action reprices the pupil's
 * transport instalments on save — see `updateRider`. The pupil themself cannot
 * be changed here: that would be a different subscription, not an edit of this
 * one.
 */
function EditRiderDialog({
  rider,
  stops,
  onClose,
}: {
  rider: RouteDetail["riders"][number];
  stops: StopRow[];
  onClose: () => void;
}) {
  const t = useT();
  const [state, formAction] = React.useActionState(updateRiderAction, IDLE);
  useActionFeedback(state, { onSuccess: onClose });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.transport.editRider}</DialogTitle>
            <DialogDescription>{rider.studentName}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={rider.subscriptionId} />

          <Field label={t.transport.stop} name="stopId" error={errors.stopId} required>
            <Select name="stopId" defaultValue={rider.stopId} required>
              <SelectTrigger id="stopId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stops.map((stop) => (
                  <SelectItem key={stop.id} value={stop.id}>
                    {stop.name}
                    {stop.zoneName ? ` · ${stop.zoneName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.direction} name="direction">
              <Select name="direction" defaultValue={rider.direction}>
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

            <Field label={t.transport.subscriptionStatus} name="status">
              <Select name="status" defaultValue={rider.status}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t.transportOptions.subscriptionStatuses[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.transport.startsOn} name="startsOn">
              <Input id="startsOn" name="startsOn" type="date" dir="ltr" />
            </Field>
            <Field label={t.transport.endsOn} name="endsOn">
              <Input id="endsOn" name="endsOn" type="date" dir="ltr" />
            </Field>
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
