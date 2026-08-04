"use client";

import { MapPinIcon, PlusIcon, UsersIcon } from "lucide-react";
import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import { Combobox } from "@/components/form/combobox";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionFeedback } from "@/components/form/use-action-feedback";
import { useT } from "@/components/providers/i18n-provider";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { IDLE, type ActionState } from "@/lib/action-state";
import { valueOf } from "@/lib/form-values";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteStopAction,
  saveStopAction,
  setRouteNeighbourhoodsAction,
  setRouteSchedulesAction,
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
} from "@/modules/transport/queries";
import { Field } from "@/modules/transport/components/field";

/**
 * One line: the stops it serves, in order, and everyone riding it.
 *
 * The stops come first because they are what the riders are chosen from: a line
 * with no stops cannot take passengers, and the screen shows why. Nothing here
 * is a price — the bus is billed at enrolment, from the price list.
 */
export function RoutePanel({
  route,
  neighbourhoods,
  schedules,
  subscribable,
  permissions,
}: {
  route: RouteDetail;
  /** The school's quartiers, for the stop dialog — see modules/geography. */
  neighbourhoods: { id: string; label: string }[];
  /** The year's runs, declared under /configuration/logistique. */
  schedules: { id: string; label: string; name: string; direction: string }[];
  subscribable: SubscribableStudent[];
  permissions: { canManage: boolean; canSubscribe: boolean };
}) {
  const t = useT();

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary
          label={t.transport.assignedVehicle}
          value={route.vehicleRegistration ?? t.transport.noVehicleAssigned}
          hint={route.driverName ?? undefined}
        />
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
          <TabsTrigger value="neighbourhoods">
            {t.transport.routeNeighbourhoods}
            <Badge variant="secondary" className="ms-1.5 tabular-nums">
              {route.neighbourhoodIds.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="schedules">
            {t.transport.routeSchedules}
            <Badge variant="secondary" className="ms-1.5 tabular-nums">
              {route.scheduleIds.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stops">
          <StopsTab
            route={route}
            neighbourhoods={neighbourhoods}
            canManage={permissions.canManage}
          />
        </TabsContent>

        <TabsContent value="riders">
          <RidersTab
            route={route}
            subscribable={subscribable}
            canSubscribe={permissions.canSubscribe}
          />
        </TabsContent>

        <TabsContent value="neighbourhoods">
          <AssignmentTab
            routeId={route.id}
            action={setRouteNeighbourhoodsAction}
            fieldName="neighbourhoodIds"
            selected={route.neighbourhoodIds}
            options={neighbourhoods}
            title={t.transport.routeNeighbourhoods}
            description={t.transport.routeNeighbourhoodsHint}
            emptyTitle={t.transport.noNeighbourhoods}
            emptyHint={t.transport.noNeighbourhoodsHint}
            canManage={permissions.canManage}
          />
        </TabsContent>

        <TabsContent value="schedules">
          <AssignmentTab
            routeId={route.id}
            action={setRouteSchedulesAction}
            fieldName="scheduleIds"
            selected={route.scheduleIds}
            options={schedules.map((schedule) => ({
              id: schedule.id,
              label: `${schedule.label} · ${schedule.name}`,
            }))}
            title={t.transport.routeSchedules}
            description={t.transport.routeSchedulesHint}
            emptyTitle={t.transport.noSchedules}
            emptyHint={t.transport.noSchedulesHint}
            canManage={permissions.canManage}
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
        <p
          className={cn("font-semibold", tone === "bad" && "text-destructive")}
        >
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
  neighbourhoods,
  canManage,
}: {
  route: RouteDetail;
  /** The school's quartiers, for the stop dialog — see modules/geography. */
  neighbourhoods: { id: string; label: string }[];
  canManage: boolean;
}) {
  const t = useT();
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
                  <TableHead>{t.transport.pickupTime}</TableHead>
                  <TableHead className="text-end">
                    {t.transport.riders}
                  </TableHead>
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
                      {/* Quartier and landmark on one line — together they are
                        "where is this stop", which is one question. */}
                      {stop.neighbourhoodName || stop.landmark ? (
                        <span className="text-muted-foreground block text-xs">
                          {[stop.neighbourhoodName, stop.landmark]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(stop)}
                        >
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
          neighbourhoods={neighbourhoods}
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
  neighbourhoods,
  nextPosition,
  onClose,
}: {
  routeId: string;
  stop: StopRow | null;
  /** The school's quartiers, for the stop dialog — see modules/geography. */
  neighbourhoods: { id: string; label: string }[];
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
            <DialogTitle>
              {stop ? t.transport.editStop : t.transport.newStop}
            </DialogTitle>
            <DialogDescription>{t.transport.landmarkHint}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="routeId" value={routeId} />
          {stop ? <input type="hidden" name="id" value={stop.id} /> : null}

          <Field
            label={t.transport.stopName}
            name="name"
            error={errors.name}
            required
          >
            <Input
              id="name"
              name="name"
              defaultValue={valueOf(state, "name", stop?.name)}
              required
            />
          </Field>

          <Field label={t.transport.landmark} name="landmark">
            <Input
              id="landmark"
              name="landmark"
              defaultValue={valueOf(state, "landmark", stop?.landmark)}
            />
          </Field>

          {/* The quartier is where the stop *is*; the zone below is what riding
            from it costs. Two separate questions — see the note on
            prisma/schema/geography/neighbourhood.prisma. */}
          <Field label={t.transport.neighbourhood} name="neighbourhoodId">
            <Select
              name="neighbourhoodId"
              defaultValue={
                valueOf(state, "neighbourhoodId", stop?.neighbourhoodId) ||
                "__none__"
              }
            >
              <SelectTrigger id="neighbourhoodId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.common.none}</SelectItem>
                {neighbourhoods.map((neighbourhood) => (
                  <SelectItem key={neighbourhood.id} value={neighbourhood.id}>
                    {neighbourhood.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">

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
            <Field
              label={t.transport.pickupTime}
              name="pickupTime"
              error={errors.pickupTime}
            >
              <Input
                id="pickupTime"
                name="pickupTime"
                dir="ltr"
                placeholder="07:30"
                defaultValue={valueOf(state, "pickupTime", stop?.pickupTime)}
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
                defaultValue={valueOf(state, "dropoffTime", stop?.dropoffTime)}
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
}: {
  route: RouteDetail;
  subscribable: SubscribableStudent[];
  canSubscribe: boolean;
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
    canSubscribe &&
    route.stops.length > 0 &&
    route.remaining > 0 &&
    subscribable.length > 0;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {t.transport.billingNote}
        </p>
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
            <Combobox
              id="enrollmentId"
              name="enrollmentId"
              required
              placeholder={t.transport.pupil}
              options={subscribable.map((option) => ({
                value: option.enrollmentId,
                label: option.label,
              }))}
            />
          </Field>

          <Field
            label={t.transport.stop}
            name="stopId"
            error={errors.stopId}
            required
          >
            <Select name="stopId" required>
              <SelectTrigger id="stopId" className="w-full">
                <SelectValue placeholder={t.transport.stop} />
              </SelectTrigger>
              <SelectContent>
                {stops.map((stop) => (
                  <SelectItem key={stop.id} value={stop.id}>
                    {stop.name}
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

          <Field
            label={t.transport.stop}
            name="stopId"
            error={errors.stopId}
            required
          >
            <Select name="stopId" defaultValue={rider.stopId} required>
              <SelectTrigger id="stopId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stops.map((stop) => (
                  <SelectItem key={stop.id} value={stop.id}>
                    {stop.name}
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

/**
 * A checklist of things a circuit may be given: its quartiers, or its runs.
 *
 * One component for both because the two are the same interaction — tick a set,
 * save it whole. The whole desired set is submitted rather than a diff, exactly
 * as the permission matrix does it: working out what changed on the client would
 * only add a chance to get it wrong, and the server re-derives every id against
 * the school or the year before writing.
 *
 * Radix's Checkbox is not a native input, so each ticked row carries a hidden
 * field — the same trick `PermissionMatrix` uses.
 */
function AssignmentTab({
  routeId,
  action,
  fieldName,
  selected,
  options,
  title,
  description,
  emptyTitle,
  emptyHint,
  canManage,
}: {
  routeId: string;
  action: (
    prevState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  fieldName: string;
  selected: string[];
  options: { id: string; label: string }[];
  title: string;
  description: string;
  emptyTitle: string;
  emptyHint: string;
  canManage: boolean;
}) {
  const t = useT();
  const [state, formAction] = useActionState(action, IDLE);
  useActionFeedback(state);

  const [ticked, setTicked] = React.useState<Set<string>>(
    () => new Set(selected),
  );

  function toggle(id: string, checked: boolean) {
    setTicked((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (options.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<MapPinIcon className="size-5" />}
            title={emptyTitle}
            description={emptyHint}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="routeId" value={routeId} />

          <fieldset
            disabled={!canManage}
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {options.map((option) => {
              const checked = ticked.has(option.id);
              const id = `${fieldName}-${option.id}`;
              return (
                <label
                  key={option.id}
                  htmlFor={id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={!canManage}
                    onCheckedChange={(value) => toggle(option.id, value === true)}
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                  {checked ? (
                    <input type="hidden" name={fieldName} value={option.id} />
                  ) : null}
                </label>
              );
            })}
          </fieldset>

          {canManage ? (
            <div className="flex justify-end">
              <SubmitButton>{t.common.save}</SubmitButton>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
