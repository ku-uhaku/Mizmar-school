"use client";

import * as React from "react";
import {
  CalendarClockIcon,
  MapPinIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UndoIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { EmptyState } from "@/components/shell/empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import {
  cancelEventAction,
  deleteEventAction,
  publishEventAction,
  unpublishEventAction,
} from "@/modules/events/actions";
import { isCancellable, isPublishable } from "@/modules/events/enums";
import { EventDialog } from "@/modules/events/components/event-dialog";
import type { AudienceChoice, EventRow } from "@/modules/events/queries";

/**
 * The school's own calendar of announcements.
 *
 * Three tabs, because they are three different jobs: what is coming up (what a
 * school looks at), what is still a draft (what somebody has to finish), and
 * what has been and gone (what nobody needs unless they are looking for it).
 * Drafts are listed apart rather than mixed in by date, since an unpublished
 * event sitting quietly among published ones is exactly how a réunion goes
 * unannounced.
 */
export function EventsManager({
  events,
  levels,
  classes,
  permissions,
}: {
  events: EventRow[];
  levels: AudienceChoice[];
  classes: AudienceChoice[];
  permissions: { canManage: boolean; canPublish: boolean; canDelete: boolean };
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = React.useState<EventRow | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<EventRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const drafts = events.filter((event) => event.status === "DRAFT");
  const announced = events.filter((event) => event.status !== "DRAFT");
  const upcoming = announced.filter((event) => event.isUpcoming);
  const past = announced.filter((event) => !event.isUpcoming);

  function run(action: () => Promise<{ status: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") toast.success(result.message ?? "");
      else toast.error(result.message ?? t.errors.unexpected);
    });
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(event: EventRow) {
    setEditing(event);
    setDialogOpen(true);
  }

  const lists: { value: string; label: string; rows: EventRow[]; empty: string }[] =
    [
      {
        value: "upcoming",
        label: t.event.upcoming,
        rows: upcoming,
        empty: t.event.noUpcoming,
      },
      {
        value: "drafts",
        label: t.event.drafts,
        rows: drafts,
        empty: t.event.noEvents,
      },
      { value: "past", label: t.event.past, rows: past, empty: t.event.noEvents },
    ];

  if (events.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<CalendarClockIcon className="size-5" />}
              title={t.event.noEvents}
              description={t.event.noEventsHint}
              action={
                permissions.canManage ? (
                  <Button size="sm" onClick={openNew}>
                    <PlusIcon />
                    {t.event.newEvent}
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>

        {permissions.canManage ? (
          <EventDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            event={editing}
            levels={levels}
            classes={classes}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Tabs defaultValue="upcoming" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {lists.map((list) => (
              <TabsTrigger key={list.value} value={list.value}>
                {list.label}
                {list.rows.length > 0 ? (
                  <Badge variant="secondary" className="ms-2">
                    {list.rows.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {permissions.canManage ? (
            <Button size="sm" onClick={openNew}>
              <PlusIcon />
              {t.event.newEvent}
            </Button>
          ) : null}
        </div>

        {lists.map((list) => (
          <TabsContent key={list.value} value={list.value} className="grid gap-3">
            {list.rows.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={<CalendarClockIcon className="size-5" />}
                    title={list.empty}
                  />
                </CardContent>
              </Card>
            ) : (
              list.rows.map((event) => (
                <Card key={event.id} className="py-0">
                  <CardContent className="flex flex-wrap items-start gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "font-medium",
                            event.status === "CANCELLED" && "line-through",
                          )}
                        >
                          {event.title}
                        </span>
                        <Badge
                          variant={
                            event.status === "PUBLISHED"
                              ? "default"
                              : event.status === "CANCELLED"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {
                            t.eventOptions.statuses[
                              event.status as keyof typeof t.eventOptions.statuses
                            ]
                          }
                        </Badge>
                        <Badge variant="outline">
                          {
                            t.eventOptions.kinds[
                              event.kind as keyof typeof t.eventOptions.kinds
                            ]
                          }
                        </Badge>
                        {event.isAllDay ? (
                          <Badge variant="outline">{t.event.allDayBadge}</Badge>
                        ) : null}
                      </div>

                      <p className="text-muted-foreground mt-1 text-sm">
                        {/* An all-day event prints its date alone — printing
                          00:00 beside it is the thing `isAllDay` exists to
                          prevent. */}
                        {event.isAllDay
                          ? formatDate(event.startsAt, locale)
                          : formatDateTime(event.startsAt, locale)}
                        {event.endsAt
                          ? ` → ${
                              event.isAllDay
                                ? formatDate(event.endsAt, locale)
                                : formatDateTime(event.endsAt, locale)
                            }`
                          : ""}
                      </p>

                      {event.location ? (
                        <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                          <MapPinIcon className="size-3" />
                          {event.location}
                        </p>
                      ) : null}

                      <p className="text-muted-foreground mt-1 text-xs">
                        {event.isSchoolWide
                          ? t.event.schoolWide
                          : interpolate(t.event.audienceCount, {
                              count: event.audienceCount,
                            })}
                      </p>

                      {event.description ? (
                        <p className="mt-2 text-sm">{event.description}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {permissions.canManage ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(event)}
                        >
                          {t.common.edit}
                        </Button>
                      ) : null}

                      {permissions.canPublish && isPublishable(event.status) ? (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(() => publishEventAction(event.id))
                          }
                        >
                          <SendIcon />
                          {t.event.publish}
                        </Button>
                      ) : null}

                      {permissions.canPublish && isCancellable(event.status) ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              run(() => unpublishEventAction(event.id))
                            }
                          >
                            <UndoIcon />
                            {t.event.unpublish}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() =>
                              run(() => cancelEventAction(event.id))
                            }
                          >
                            <XCircleIcon />
                            {t.event.cancelEvent}
                          </Button>
                        </>
                      ) : null}

                      {/* Only a draft may be deleted — see the note on the
                        action. Anything announced is called off instead. */}
                      {permissions.canDelete && event.status === "DRAFT" ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t.common.delete}
                          onClick={() => setDeleting(event)}
                        >
                          <Trash2Icon />
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      {permissions.canManage ? (
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          event={editing}
          levels={levels}
          classes={classes}
        />
      ) : null}

      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t.event.deleteTitle}
        description={interpolate(t.event.deleteBody, {
          title: deleting?.title ?? "",
        })}
        action={() => deleteEventAction(deleting!.id)}
        onDeleted={() => setDeleting(null)}
      />
    </>
  );
}
