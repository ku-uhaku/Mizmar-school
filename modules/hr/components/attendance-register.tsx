"use client";

import { CalendarCheckIcon } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  markAttendanceAction,
  markDayInBulkAction,
} from "@/modules/hr/actions";
import { ATTENDANCE_STATUSES, isChargeableAbsence } from "@/modules/hr/enums";
import type { RegisterEntry } from "@/modules/hr/queries";
import { useToastedTransition } from "@/modules/hr/components/field";

/**
 * Le pointage: one day, everybody, marked in place.
 *
 * The whole table posts a mark per row rather than opening a dialog, because
 * marking a register is thirty small decisions in two minutes and a dialog per
 * person would make it a morning's work. Changing the day is a link, not client
 * state: the server holds the register, so a reload has to land on the same day.
 */
export function AttendanceRegister({
  entries,
  date,
  canMark,
}: {
  entries: RegisterEntry[];
  /** `YYYY-MM-DD` — the day being marked. */
  date: string;
  canMark: boolean;
}) {
  const t = useT();
  const { isPending, run } = useToastedTransition();

  const unmarked = entries.filter((entry) => entry.status === null);

  function mark(entry: RegisterEntry, status: string, isJustified?: boolean) {
    const formData = new FormData();
    formData.set("staffId", entry.staffId);
    formData.set("date", date);
    formData.set("status", status);
    if (isJustified ?? entry.isJustified) formData.set("isJustified", "on");
    formData.set("minutesLate", String(entry.minutesLate));
    if (entry.notes) formData.set("notes", entry.notes);
    run(() => markAttendanceAction({ status: "idle" }, formData));
  }

  function markEveryoneElse() {
    const formData = new FormData();
    formData.set("date", date);
    formData.set("status", "PRESENT");
    for (const entry of unmarked) formData.append("staffIds", entry.staffId);
    run(() => markDayInBulkAction({ status: "idle" }, formData));
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Label htmlFor="registerDate">{t.hr.day}</Label>
          {/* A link rather than a controlled input: the server holds the day's
              register, so the URL has to be what says which day it is. */}
          <Input
            id="registerDate"
            type="date"
            dir="ltr"
            defaultValue={date}
            className="w-44"
            onChange={(event) => {
              const value = event.target.value;
              if (value) window.location.search = `?date=${value}`;
            }}
          />
        </div>

        {canMark && unmarked.length > 0 ? (
          <div className="grid justify-items-end gap-1">
            <Button size="sm" onClick={markEveryoneElse} disabled={isPending}>
              {t.hr.markEveryoneElse}
            </Button>
            <p className="text-muted-foreground text-xs">{t.hr.bulkHint}</p>
          </div>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<CalendarCheckIcon className="size-5" />}
              title={t.hr.noStaff}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.hr.employee}</TableHead>
                    <TableHead>{t.hr.attendanceStatus}</TableHead>
                    <TableHead>{t.hr.justified}</TableHead>
                    <TableHead className="text-end">{t.hr.minutesLate}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const chargeable =
                      entry.status !== null &&
                      isChargeableAbsence(entry.status, entry.isJustified);

                    return (
                      <TableRow key={entry.staffId}>
                        <TableCell>
                          <span className="font-medium">{entry.staffName}</span>
                          <span className="text-muted-foreground block text-xs">
                            {entry.staffCode} ·{" "}
                            {
                              t.hrOptions.jobRoles[
                                entry.jobRole as keyof typeof t.hrOptions.jobRoles
                              ]
                            }
                          </span>
                        </TableCell>

                        <TableCell>
                          {canMark ? (
                            <Select
                              value={entry.status ?? ""}
                              onValueChange={(value) => mark(entry, value)}
                              disabled={isPending}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue placeholder={t.hr.unmarked} />
                              </SelectTrigger>
                              <SelectContent>
                                {ATTENDANCE_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {t.hrOptions.attendanceStatuses[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : entry.status === null ? (
                            <Badge variant="outline">{t.hr.unmarked}</Badge>
                          ) : (
                            <Badge variant={chargeable ? "destructive" : "secondary"}>
                              {
                                t.hrOptions.attendanceStatuses[
                                  entry.status as keyof typeof t.hrOptions.attendanceStatuses
                                ]
                              }
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          {entry.status === null ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            <Switch
                              checked={entry.isJustified}
                              disabled={!canMark || isPending}
                              onCheckedChange={(checked) =>
                                mark(entry, entry.status ?? "ABSENT", checked)
                              }
                              aria-label={t.hr.justified}
                            />
                          )}
                        </TableCell>

                        <TableCell className="text-end tabular-nums">
                          {entry.status === "LATE" ? entry.minutesLate : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
