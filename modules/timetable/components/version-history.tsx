"use client";

import * as React from "react";
import { HistoryIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { formatDateTime } from "@/lib/i18n/format";
import { interpolate } from "@/lib/i18n/format";
import {
  activateTimetableVersionAction,
  listTimetableVersionsAction,
} from "@/modules/timetable/actions";

type VersionRow = {
  id: string;
  status: string;
  label: string | null;
  seed: number | null;
  createdAt: Date;
  createdByName: string | null;
  entryCount: number;
};

/**
 * Every whole-grid snapshot this bell schedule has ever had, with a way to
 * switch back to an older one.
 *
 * ── Why this is not a delete ─────────────────────────────────────────────────
 * Generating never throws a previous grid away — see the note on
 * `TimetableVersion` — so "switch" is the only verb this needs. Activating an
 * older version does not reconstruct it: its rows already exist exactly as
 * they were left, and the flip is instant regardless of how large the grid is.
 */
export function TimetableVersionHistory({
  scheduleKind,
}: {
  scheduleKind: string;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [versions, setVersions] = React.useState<VersionRow[] | null>(null);
  const [loading, startLoading] = React.useTransition();
  const [activating, startActivating] = React.useTransition();

  function load() {
    startLoading(async () => {
      const result = await listTimetableVersionsAction(scheduleKind);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setVersions(result.versions);
    });
  }

  function activate(versionId: string) {
    startActivating(async () => {
      const result = await activateTimetableVersionAction(versionId);
      if (result.status === "success") {
        if (result.message) toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? t.errors.unexpected);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HistoryIcon />
          {t.timetable.versionHistory}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.timetable.versionHistory}</DialogTitle>
          <DialogDescription>
            {t.timetable.versionHistoryHint}
          </DialogDescription>
        </DialogHeader>

        {loading && !versions ? (
          <div className="text-muted-foreground flex justify-center p-6">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        ) : (
          <ul className="grid gap-2">
            {(versions ?? []).map((version) => (
              <li
                key={version.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {version.label || t.timetable.versionNoLabel}
                    </span>
                    <Badge
                      variant={
                        version.status === "ACTIVE" ? "default" : "outline"
                      }
                    >
                      {version.status === "ACTIVE"
                        ? t.timetable.versionActive
                        : t.timetable.versionArchived}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatDateTime(version.createdAt, locale)}
                    {version.createdByName
                      ? ` · ${interpolate(t.timetable.versionCreatedBy, {
                          name: version.createdByName,
                        })}`
                      : ""}
                    {" · "}
                    {interpolate(t.timetable.versionEntryCount, {
                      count: version.entryCount,
                    })}
                  </p>
                </div>

                {version.status === "ACTIVE" ? null : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activating}
                      >
                        {t.timetable.versionActivate}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t.timetable.versionActivateConfirmTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.timetable.versionActivateConfirmBody}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => activate(version.id)}
                          disabled={activating}
                        >
                          {activating ? (
                            <Loader2Icon className="animate-spin" />
                          ) : null}
                          {t.timetable.versionActivate}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
