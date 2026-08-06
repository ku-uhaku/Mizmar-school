"use client";

import {
  BusIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClipboardListIcon,
  PlayIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
 * L'appel for one run, as the register screen addresses it.
 *
 * `routeId:scheduleId` and the day — see the note on the attendance page. Built
 * here rather than there because this is where a run is in hand; the page only
 * ever receives the pair and re-derives both against the year.
 */
function registerHref(run: TripRunRow, date?: string): string {
  const query = new URLSearchParams({ run: `${run.routeId}:${run.scheduleId}` });
  if (date) query.set("date", date);
  return `/transport/attendance?${query.toString()}`;
}

/**
 * The day's voyages, and the buttons that move them.
 *
 * One component for the office board and the crew's own screen. They differ
 * only in which runs they are handed and how big the buttons are — the
 * lifecycle, the wording and the guards are identical, and splitting them would
 * be two screens drifting apart over the same four states.
 *
 * `driverMode` makes the primary action full-width, drops the columns a driver
 * cannot act on, and holds the buttons to the run's own hour. Someone at 6.50
 * a.m. in a yard needs one obvious target, not a table.
 *
 * `scope` is the office's switch between its own runs and every line. Null hides
 * it, which is what a driver gets — the page decides that from TRANSPORT_MANAGE
 * and re-derives it when the link is followed, so this is presentation only.
 */
export function VoyageBoard({
  runs,
  canCancel,
  driverMode = false,
  scope = null,
  date,
}: {
  runs: TripRunRow[];
  canCancel: boolean;
  driverMode?: boolean;
  scope?: "mine" | "all" | null;
  date?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
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
        // Starting a voyage *is* opening its register — the départ is what
        // declares which run is being made, and making the driver find the
        // appel afterwards is how it ends up not being taken. The other two
        // moves stay on the board: closing a run and calling one off both leave
        // the person looking at the rest of their day.
        if (next === "EN_ROUTE") router.push(registerHref(run, date));
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
      setBusyId(null);
    });
  }

  const switcher =
    scope === null ? null : (
      <div className="flex justify-end">
        <div className="bg-muted inline-flex rounded-md p-0.5">
          {(["mine", "all"] as const).map((option) => (
            <Button
              key={option}
              asChild
              size="sm"
              variant={scope === option ? "secondary" : "ghost"}
              className={cn(scope !== option && "text-muted-foreground")}
            >
              <Link
                href={{
                  pathname: "/transport/voyages",
                  query: {
                    ...(option === "all" ? { scope: "all" } : {}),
                    ...(date ? { date } : {}),
                  },
                }}
              >
                {option === "mine"
                  ? t.transport.myVoyages
                  : t.transport.voyagesAll}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    );

  if (runs.length === 0) {
    return (
      <div className="grid gap-3">
        {switcher}
        <EmptyState
          icon={<BusIcon className="size-5" />}
          title={
            driverMode ? t.transport.noRunsForDriver : t.transport.noRunsToday
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {switcher}
        {runs.map((run) => (
          <VoyageCard
            key={run.id}
            run={run}
            locale={locale}
            driverMode={driverMode}
            canCancel={canCancel}
            date={date}
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
  date,
  busy,
  onMove,
  onAskCancel,
}: {
  run: TripRunRow;
  locale: Parameters<typeof formatTime>[1];
  driverMode: boolean;
  canCancel: boolean;
  date?: string;
  busy: boolean;
  onMove: (next: "EN_ROUTE" | "ARRIVED") => void;
  onAskCancel: () => void;
}) {
  const t = useT();
  const done = run.status === "ARRIVED" || run.status === "CANCELLED";

  // A crew member may only move a voyage around its own hour — the same rule
  // the phone follows, and the one `moveTripRunAction` enforces whatever this
  // renders. The office board keeps every button, since a correction made at
  // four o'clock is exactly what it is for.
  const outOfHours = driverMode && run.window !== "OPEN";

  return (
    <Card className={cn((done || outOfHours) && "opacity-70")}>
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
          {/* Said rather than left blank: a driver looking at a card with no
              button needs to know it is the clock, not a fault. */}
          {outOfHours && !done ? (
            <p className="text-muted-foreground text-xs">
              {run.window === "UPCOMING"
                ? t.transport.runUpcoming
                : t.transport.runWindowClosed}
            </p>
          ) : null}

          {run.status === "PLANNED" && !outOfHours ? (
            <Button
              onClick={() => onMove("EN_ROUTE")}
              disabled={busy}
              className={cn(driverMode && "h-12 px-8 text-base")}
            >
              <PlayIcon />
              {t.transport.runStart}
            </Button>
          ) : null}

          {/* The register, once there is one. `Démarrer` navigates here on its
              own; this is the way back for a driver who left the screen, and
              the only way in now that the appel is off the sidebar. */}
          {run.status === "EN_ROUTE" || run.status === "ARRIVED" ? (
            <Button asChild variant="outline">
              <Link href={registerHref(run, date)}>
                <ClipboardListIcon />
                {t.transport.busRegister}
              </Link>
            </Button>
          ) : null}

          {run.status === "EN_ROUTE" && !outOfHours ? (
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
