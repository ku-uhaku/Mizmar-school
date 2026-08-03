"use client";

import {
  BusIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  PlayIcon,
  XCircleIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shell/empty-state";
import { useLocale, useT } from "@/components/providers/i18n-provider";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { moveTripRunAction } from "@/modules/transport/actions";
import type { TripRunRow } from "@/modules/transport/queries";

/**
 * The day's voyages, and the buttons that move them.
 *
 * One component for the office board and the driver's phone. They differ only
 * in which runs they are handed and how big the buttons are — the lifecycle,
 * the wording and the guards are identical, and splitting them would be two
 * screens drifting apart over the same four states.
 *
 * `driverMode` makes the primary action full-width and drops the columns a
 * driver cannot act on. Someone holding a phone at 6.50 a.m. in a yard needs one
 * obvious target, not a table.
 */
export function VoyageBoard({
  runs,
  canCancel,
  driverMode = false,
}: {
  runs: TripRunRow[];
  canCancel: boolean;
  driverMode?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [pendingCancel, setPendingCancel] = React.useState<TripRunRow | null>(
    null,
  );
  const [reason, setReason] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function move(
    run: TripRunRow,
    next: "EN_ROUTE" | "ARRIVED" | "CANCELLED",
    cancelReason?: string,
  ) {
    setBusyId(run.id);
    startTransition(async () => {
      const result = await moveTripRunAction(run.id, next, cancelReason);
      if (result.status === "success") {
        toast.success(result.message ?? "");
        setPendingCancel(null);
        setReason("");
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
      setBusyId(null);
    });
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={<BusIcon className="size-5" />}
        title={driverMode ? t.transport.noRunsForDriver : t.transport.noRunsToday}
      />
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {runs.map((run) => (
          <VoyageCard
            key={run.id}
            run={run}
            locale={locale}
            driverMode={driverMode}
            canCancel={canCancel}
            busy={isPending && busyId === run.id}
            onMove={(next) => move(run, next)}
            onAskCancel={() => {
              setPendingCancel(run);
              setReason("");
            }}
          />
        ))}
      </div>

      <AlertDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setPendingCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.transport.cancelRunTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCancel
                ? `${pendingCancel.routeCode} · ${pendingCancel.scheduleName}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="cancel-run-reason">{t.transport.runCancel}</Label>
            <Textarea
              id="cancel-run-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={300}
              disabled={isPending}
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              {t.transport.cancelRunHint}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pendingCancel) move(pendingCancel, "CANCELLED", reason);
              }}
              disabled={isPending || reason.trim().length < 3}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t.transport.runCancel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function VoyageCard({
  run,
  locale,
  driverMode,
  canCancel,
  busy,
  onMove,
  onAskCancel,
}: {
  run: TripRunRow;
  locale: Parameters<typeof formatTime>[1];
  driverMode: boolean;
  canCancel: boolean;
  busy: boolean;
  onMove: (next: "EN_ROUTE" | "ARRIVED") => void;
  onAskCancel: () => void;
}) {
  const t = useT();
  const done = run.status === "ARRIVED" || run.status === "CANCELLED";

  return (
    <Card className={cn(done && "opacity-70")}>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* A colour bar rather than only a badge: a board is read across a room,
            and the state has to survive being glanced at. */}
        <span
          aria-hidden
          className={cn(
            "h-10 w-1 shrink-0 rounded-full",
            run.status === "EN_ROUTE" && "bg-success",
            run.status === "ARRIVED" && "bg-muted-foreground/40",
            run.status === "CANCELLED" && "bg-destructive",
            run.status === "PLANNED" && "bg-border",
          )}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {run.routeCode} · {run.scheduleName}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {interpolate(t.transport.plannedAt, {
              time: run.plannedDepartureTime,
            })}
            {run.vehicleRegistration ? ` · ${run.vehicleRegistration}` : ""}
            {!driverMode && run.driverName ? ` · ${run.driverName}` : ""}
            {" · "}
            {interpolate(t.transport.riderCount, { count: run.riderCount })}
          </p>
        </div>

        <TripState run={run} locale={locale} />

        <div className="flex shrink-0 items-center gap-2">
          {run.status === "PLANNED" ? (
            <Button
              onClick={() => onMove("EN_ROUTE")}
              disabled={busy}
              className={cn(driverMode && "h-12 px-8 text-base")}
            >
              <PlayIcon />
              {t.transport.runStart}
            </Button>
          ) : null}

          {run.status === "EN_ROUTE" ? (
            <Button
              onClick={() => onMove("ARRIVED")}
              disabled={busy}
              variant="secondary"
              className={cn(driverMode && "h-12 px-8 text-base")}
            >
              <CheckCircle2Icon />
              {t.transport.runArrive}
            </Button>
          ) : null}

          {/* Calling a run off is the office's, not the driver's — a breakdown is
              reported, and somebody who answers for the day decides. */}
          {canCancel && !driverMode && !done ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAskCancel}
              disabled={busy}
              aria-label={t.transport.runCancel}
            >
              <XCircleIcon />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** The stamps, and how late it was. */
function TripState({
  run,
  locale,
}: {
  run: TripRunRow;
  locale: Parameters<typeof formatTime>[1];
}) {
  const t = useT();

  if (run.status === "CANCELLED") {
    return (
      <div className="min-w-0">
        <Badge variant="destructive">{t.transport.runCancelled}</Badge>
        {run.cancelReason ? (
          <p className="text-muted-foreground mt-1 max-w-56 truncate text-xs">
            {run.cancelReason}
          </p>
        ) : null}
      </div>
    );
  }

  if (run.status === "PLANNED") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CircleDashedIcon className="size-3" />
        {run.plannedDepartureTime}
      </Badge>
    );
  }

  return (
    <div className="min-w-0 text-xs">
      <p className="flex items-center gap-1.5">
        {run.startedAt ? (
          <span className="tabular-nums">
            {interpolate(t.transport.leftAt, {
              time: formatTime(run.startedAt, locale),
            })}
          </span>
        ) : null}
        <Delay minutes={run.delayMinutes} />
      </p>
      {run.arrivedAt ? (
        <p className="text-muted-foreground tabular-nums">
          {interpolate(t.transport.arrivedAt, {
            time: formatTime(run.arrivedAt, locale),
          })}
          {run.arrivedByName ? ` · ${run.arrivedByName}` : ""}
        </p>
      ) : (
        <p className="text-success font-medium">{t.transport.runsEnRouteOne}</p>
      )}
    </div>
  );
}

/**
 * Lateness, worded rather than signed.
 *
 * "−4 min" reads as a mistake to anybody not expecting the convention, and a bus
 * leaving early is a real thing that matters — children who arrive at the stop
 * on time and miss it. So early and late are separate sentences, and a couple of
 * minutes either way is simply "on time" rather than noise on the board.
 */
function Delay({ minutes }: { minutes: number | null }) {
  const t = useT();
  if (minutes === null) return null;

  if (Math.abs(minutes) <= 2) {
    return <span className="text-muted-foreground">{t.transport.onTime}</span>;
  }

  return (
    <span className={minutes > 0 ? "text-warning" : "text-muted-foreground"}>
      {minutes > 0
        ? interpolate(t.transport.lateBy, { count: minutes })
        : interpolate(t.transport.earlyBy, { count: Math.abs(minutes) })}
    </span>
  );
}
