"use client";

import Link from "next/link";
import { BusIcon, PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

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
import { IDLE } from "@/lib/action-state";
import { checkedOf, valueOf } from "@/lib/form-values";
import { interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  deleteRouteAction,
  saveRouteAction,
} from "@/modules/transport/actions";
import { TRANSPORT_DIRECTIONS } from "@/modules/transport/enums";
import { Field } from "@/modules/transport/components/field";
import type { RouteRow } from "@/modules/transport/queries";

/** The lines the school runs, and the bus put on each of them. */
export function RouteList({
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
          {/* Creation is a wizard on its own page, not a dialog: a line needs
              its runs, its quartiers and its stops before it is a line, and a
              modal that created it from four fields left it live and empty. */}
          <Button asChild size="sm">
            <Link href="/transport/routes/new">
              <PlusIcon className="size-4" />
              {t.transport.newRoute}
            </Link>
          </Button>
        </div>
      ) : null}

      {routes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BusIcon className="size-5" />}
              title={t.transport.noRoutes}
              action={
                permissions.canManage ? (
                  <Button asChild size="sm">
                    <Link href="/transport/routes/new">
                      <PlusIcon className="size-4" />
                      {t.transport.newRoute}
                    </Link>
                  </Button>
                ) : null
              }
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
                      href={`/transport/routes/${route.id}`}
                      className="font-medium hover:underline"
                    >
                      {route.code} · {route.name}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {route.vehicleRegistration ??
                        t.transport.noVehicleAssigned}
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
                          route.remaining === 0
                            ? "bg-destructive"
                            : "bg-primary",
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(route)}
                    >
                      {t.common.edit}
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/transport/routes/${route.id}`}>
                        {t.transport.stops}
                      </Link>
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

      {editing ? (
        <RouteDialog
          route={editing}
          vehicleOptions={vehicleOptions}
          onClose={() => setEditing(null)}
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

/** Edits a line that exists. Drawing a new one is the wizard's job. */
function RouteDialog({
  route,
  vehicleOptions,
  onClose,
}: {
  route: RouteRow;
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
            <DialogTitle>{t.transport.editRoute}</DialogTitle>
            <DialogDescription>{t.transport.capacityHint}</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={route.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t.transport.routeCode}
              name="code"
              error={errors.code}
              required
            >
              <Input
                id="code"
                name="code"
                defaultValue={valueOf(state, "code", route.code)}
                required
              />
            </Field>
            <Field
              label={t.transport.routeName}
              name="name"
              error={errors.name}
              required
            >
              <Input
                id="name"
                name="name"
                defaultValue={valueOf(state, "name", route.name)}
                required
              />
            </Field>
          </div>

          <Field label={t.transport.direction} name="direction">
            <Select
              name="direction"
              defaultValue={
                valueOf(state, "direction", route.direction) || "BOTH"
              }
            >
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
              <Select
                name="vehicleId"
                defaultValue={
                  valueOf(state, "vehicleId", route.vehicleId) || "__none__"
                }
              >
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

            <Field
              label={t.transport.capacity}
              name="capacity"
              error={errors.capacity}
            >
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min="0"
                dir="ltr"
                defaultValue={
                  route.seats && route.vehicleId === null ? route.seats : ""
                }
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="isActive">{t.common.active}</Label>
            <Switch
              id="isActive"
              name="isActive"
              defaultChecked={checkedOf(
                state,
                "isActive",
                route.isActive,
              )}
            />
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
