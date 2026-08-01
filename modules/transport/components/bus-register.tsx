"use client";

import { BusIcon, CheckCheckIcon } from "lucide-react";
import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { useToastedTransition } from "@/modules/hr/components/field";
import {
  markBusRunInBulkAction,
  markRiderAttendanceAction,
} from "@/modules/transport/actions";
import {
  MAX_MINUTES_WAITED,
  RIDER_ATTENDANCE_STATUSES,
  tallyBusRegister,
} from "@/modules/transport/enums";
import type {
  BusRegisterEntry,
  BusRunOption,
} from "@/modules/transport/queries";

/** How each status colours its button when it is the one selected. */
const STATUS_STYLES: Record<string, string> = {
  PRESENT: "data-[on=true]:bg-primary data-[on=true]:text-primary-foreground",
  LATE: "data-[on=true]:bg-warning data-[on=true]:text-background",
  ABSENT: "data-[on=true]:bg-destructive data-[on=true]:text-background",
  EXCUSED: "data-[on=true]:bg-muted-foreground data-[on=true]:text-background",
};

/**
 * L'appel du bus: one run, one day, marked in place.
 *
 * ── Why it is buttons and not a dialog ──────────────────────────────────────
 * This is taken standing at the door of a bus with thirty children getting on.
 * Every mark is one tap on the row, and the whole sheet is one screen — a
 * dialog per child would mean the register stops being taken by October, which
 * is what happened to the paper one. It is the same decision the classroom
 * register makes, for the same reason.
 *
 * The run and the day live in the URL rather than in component state: the
 * server builds this register, so a reload — or a phone waking up — has to land
 * back on the run being called and not on this morning's.
 */
export function BusRegister({
  runs,
  entries,
  routeId,
  scheduleId,
  date,
  canMark,
}: {
  runs: BusRunOption[];
  /** Null when no run is selected yet, or the selected one is unreachable. */
  entries: BusRegisterEntry[] | null;
  routeId: string | null;
  scheduleId: string | null;
  /** `YYYY-MM-DD` — the day being called. */
  date: string;
  canMark: boolean;
}) {
  const t = useT();
  const { isPending, run } = useToastedTransition();

  const tally = React.useMemo(
    () => tallyBusRegister(entries ?? []),
    [entries],
  );

  const mark = React.useCallback(
    (
      entry: BusRegisterEntry,
      status: string,
      overrides?: { minutesLate?: number; isJustified?: boolean },
    ) => {
      if (!routeId) return;
      const formData = new FormData();
      formData.set("subscriptionId", entry.subscriptionId);
      formData.set("routeId", routeId);
      if (scheduleId) formData.set("scheduleId", scheduleId);
      formData.set("date", date);
      formData.set("status", status);
      formData.set(
        "minutesLate",
        String(overrides?.minutesLate ?? entry.minutesLate),
      );
      if (overrides?.isJustified ?? entry.isJustified) {
        formData.set("isJustified", "on");
      }
      if (entry.reason) formData.set("reason", entry.reason);
      run(() => markRiderAttendanceAction({ status: "idle" }, formData));
    },
    [routeId, scheduleId, date, run],
  );

  function markRest() {
    if (!routeId || !entries) return;
    const formData = new FormData();
    formData.set("routeId", routeId);
    if (scheduleId) formData.set("scheduleId", scheduleId);
    formData.set("date", date);
    formData.set("status", "PRESENT");
    for (const entry of entries) {
      if (entry.status === null) {
        formData.append("subscriptionIds", entry.subscriptionId);
      }
    }
    run(() => markBusRunInBulkAction({ status: "idle" }, formData));
  }

  /** Navigating is the state change — see the note at the top. */
  function go(next: { run?: string; date?: string }) {
    const params = new URLSearchParams();
    const runValue =
      next.run ?? (routeId ? `${routeId}:${scheduleId ?? ""}` : "");
    if (runValue) params.set("run", runValue);
    params.set("date", next.date ?? date);
    window.location.href = `/transport/attendance?${params.toString()}`;
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<BusIcon className="size-5" />}
            title={t.transport.noRuns}
            description={t.transport.noRunsHint}
          />
        </CardContent>
      </Card>
    );
  }

  const selected = routeId ? `${routeId}:${scheduleId ?? ""}` : "";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="run">{t.transport.chooseRun}</Label>
          <Select value={selected} onValueChange={(value) => go({ run: value })}>
            <SelectTrigger id="run" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {runs.map((option) => {
                const value = `${option.routeId}:${option.scheduleId ?? ""}`;
                return (
                  <SelectItem key={value} value={value}>
                    {option.routeLabel}
                    {option.scheduleLabel ? ` · ${option.scheduleLabel}` : ""}
                    {` · ${option.riderCount}`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="registerDate">{t.transport.fuelDate}</Label>
          <Input
            id="registerDate"
            type="date"
            dir="ltr"
            value={date}
            className="w-44"
            onChange={(event) => go({ date: event.target.value })}
          />
        </div>

        {canMark && entries && tally.unmarked > 0 ? (
          <Button variant="outline" disabled={isPending} onClick={markRest}>
            <CheckCheckIcon />
            {t.transport.markRest}
          </Button>
        ) : null}
      </div>

      {entries === null ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BusIcon className="size-5" />}
              title={t.transport.chooseRun}
              description={t.transport.attendanceSubtitle}
            />
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BusIcon className="size-5" />}
              title={t.transport.noRidersOnRun}
              description={t.transport.noRidersHint}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Stat
              label={t.transportOptions.riderAttendanceStatuses.PRESENT}
              value={tally.present}
            />
            <Stat
              label={t.transportOptions.riderAttendanceStatuses.LATE}
              value={tally.late}
              tone={tally.late > 0 ? "warn" : undefined}
            />
            <Stat
              label={t.transportOptions.riderAttendanceStatuses.ABSENT}
              value={tally.absent}
              tone={tally.absent > 0 ? "bad" : undefined}
            />
            <Stat
              label={t.transportOptions.riderAttendanceStatuses.EXCUSED}
              value={tally.excused}
            />
            <Stat label={t.transport.unmarked} value={tally.unmarked} />
          </div>

          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {entries.map((entry) => (
                  <RiderRow
                    key={entry.subscriptionId}
                    entry={entry}
                    canMark={canMark}
                    isPending={isPending}
                    onMark={mark}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Said once, at the foot, because it is the thing most likely to be
            misunderstood about this screen. */}
          <p className="text-muted-foreground text-xs">
            {t.transport.registerNote}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "bad";
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular-nums",
        tone === "warn" && "border-warning text-warning",
        tone === "bad" && "border-destructive text-destructive",
      )}
    >
      {label} · {value}
    </Badge>
  );
}

function RiderRow({
  entry,
  canMark,
  isPending,
  onMark,
}: {
  entry: BusRegisterEntry;
  canMark: boolean;
  isPending: boolean;
  onMark: (
    entry: BusRegisterEntry,
    status: string,
    overrides?: { minutesLate?: number; isJustified?: boolean },
  ) => void;
}) {
  const t = useT();

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-40 flex-1">
        <p className="truncate font-medium">{entry.studentName}</p>
        <p className="text-muted-foreground truncate text-xs">
          {entry.stopName}
          {entry.pickupTime ? ` · ${entry.pickupTime}` : ""}
          {entry.className ? ` · ${entry.className}` : ""}
        </p>
      </div>

      {canMark ? (
        <div className="flex flex-wrap gap-1">
          {RIDER_ATTENDANCE_STATUSES.map((status) => (
            <Button
              key={status}
              size="sm"
              variant="outline"
              disabled={isPending}
              data-on={entry.status === status}
              className={STATUS_STYLES[status]}
              onClick={() => onMark(entry, status)}
            >
              {t.transportOptions.riderAttendanceStatuses[status]}
            </Button>
          ))}
        </div>
      ) : entry.status === null ? (
        <Badge variant="outline">{t.transport.unmarked}</Badge>
      ) : (
        <Badge
          variant={entry.status === "ABSENT" ? "destructive" : "secondary"}
        >
          {
            t.transportOptions.riderAttendanceStatuses[
              entry.status as keyof typeof t.transportOptions.riderAttendanceStatuses
            ]
          }
        </Badge>
      )}

      {/* Only on a retard, and disabled otherwise so the two cannot disagree. */}
      <Input
        type="number"
        min={0}
        max={MAX_MINUTES_WAITED}
        dir="ltr"
        className="w-20 tabular-nums"
        placeholder={t.transport.minutesWaited}
        aria-label={t.transport.minutesWaited}
        defaultValue={entry.status === "LATE" ? entry.minutesLate : ""}
        disabled={!canMark || entry.status !== "LATE" || isPending}
        onBlur={(event) => {
          const minutes = Number(event.target.value);
          if (minutes === entry.minutesLate) return;
          onMark(entry, "LATE", { minutesLate: minutes });
        }}
      />

      {/* Only meaningful when they were not on the bus. */}
      <div className="flex items-center gap-2">
        <Switch
          id={`justified-${entry.subscriptionId}`}
          checked={entry.isJustified}
          disabled={
            !canMark ||
            isPending ||
            entry.status === null ||
            entry.status === "PRESENT"
          }
          onCheckedChange={(checked) =>
            onMark(entry, entry.status ?? "ABSENT", { isJustified: checked })
          }
        />
        <Label
          htmlFor={`justified-${entry.subscriptionId}`}
          className="text-muted-foreground text-xs"
        >
          {t.transport.justified}
        </Label>
      </div>
    </li>
  );
}
