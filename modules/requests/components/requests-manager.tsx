"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  HandCoinsIcon,
  PackageCheckIcon,
  XCircleIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shell/empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, interpolate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { HandleDialog } from "@/modules/requests/components/handle-dialog";
import { OFFICE_MOVES, type RequestStatus } from "@/modules/requests/enums";
import type { RequestRow, RequestSummary } from "@/modules/requests/queries";

/**
 * The guichet's queue of papers families have asked for.
 *
 * ── Two lists, not one with a filter ────────────────────────────────────────
 * "What do we owe people" and "what did we do" are different jobs done at
 * different times. The queue is oldest first — a desk works through what it owes
 * in the order it was asked, and a demande from three weeks ago must not sink
 * under this morning's — while the archive is only ever read backwards, looking
 * for one thing.
 *
 * ── The buttons come from the workflow table ────────────────────────────────
 * Each row offers exactly the moves `OFFICE_MOVES` allows from where it is, so
 * a button can never exist for something the server would refuse. That is also
 * why "accept" disappears once a paper is ready: there is nothing left to
 * promise.
 */
export function RequestsManager({
  open,
  closed,
  summary,
  canHandle,
}: {
  open: RequestRow[];
  closed: RequestRow[];
  summary: RequestSummary;
  canHandle: boolean;
}) {
  const { t } = useI18n();
  const [handling, setHandling] = React.useState<{
    request: RequestRow;
    status: RequestStatus;
  } | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<ClockIcon className="size-4" />}
          label={t.request.pendingCount}
          value={summary.pending}
        />
        <Stat
          icon={<XCircleIcon className="size-4" />}
          label={t.request.overdueCount}
          value={summary.overdue}
          tone={summary.overdue > 0 ? "danger" : undefined}
        />
        <Stat
          icon={<PackageCheckIcon className="size-4" />}
          label={t.request.readyCount}
          value={summary.ready}
        />
      </div>

      <Tabs defaultValue="queue" className="mt-4">
        <TabsList>
          <TabsTrigger value="queue">
            {t.request.queue}
            {open.length > 0 ? (
              <Badge variant="secondary" className="ms-2">
                {open.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="archive">{t.request.archive}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3">
          {open.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<FileTextIcon className="size-5" />}
                  title={t.request.empty}
                />
              </CardContent>
            </Card>
          ) : (
            open.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                canHandle={canHandle}
                onHandle={(status) => setHandling({ request, status })}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="archive" className="space-y-3">
          {closed.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<FileTextIcon className="size-5" />}
                  title={t.request.emptyArchive}
                />
              </CardContent>
            </Card>
          ) : (
            closed.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                canHandle={false}
                onHandle={() => undefined}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <HandleDialog
        open={handling !== null}
        request={handling?.request ?? null}
        status={handling?.status ?? null}
        onClose={() => setHandling(null)}
      />
    </>
  );
}

/** The icon and tone each move is offered with. */
const MOVE_LOOK: Record<
  string,
  { icon: React.ReactNode; variant: "default" | "outline" | "destructive" }
> = {
  ACCEPTED: { icon: <ClockIcon />, variant: "default" },
  READY: { icon: <PackageCheckIcon />, variant: "default" },
  COLLECTED: { icon: <HandCoinsIcon />, variant: "outline" },
  REJECTED: { icon: <XCircleIcon />, variant: "outline" },
};

const MOVE_LABEL_KEY: Record<string, "accept" | "markReady" | "markCollected" | "reject"> =
  {
    ACCEPTED: "accept",
    READY: "markReady",
    COLLECTED: "markCollected",
    REJECTED: "reject",
  };

function RequestCard({
  request,
  canHandle,
  onHandle,
}: {
  request: RequestRow;
  canHandle: boolean;
  onHandle: (status: RequestStatus) => void;
}) {
  const { t, locale } = useI18n();
  const statuses = t.requestOptions.statuses as Record<string, string>;
  const moves = OFFICE_MOVES[request.status as RequestStatus] ?? [];

  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{request.typeName}</h3>
              {request.copies > 1 ? (
                <Badge variant="outline">
                  {interpolate(t.request.copiesCount, { count: request.copies })}
                </Badge>
              ) : null}
              <Badge
                variant={request.status === "PENDING" ? "default" : "secondary"}
              >
                {statuses[request.status] ?? request.status}
              </Badge>
              {request.isOverdue ? (
                <Badge variant="destructive">{t.request.overdue}</Badge>
              ) : null}
            </div>

            <p className="text-sm">
              {request.studentName}
              {request.className ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {request.className}
                </span>
              ) : null}
              <span className="text-muted-foreground" dir="ltr">
                {" "}
                · {request.studentCode}
              </span>
            </p>

            <p className="text-muted-foreground text-xs">
              {t.request.askedOn} {formatDateTime(request.requestedAt, locale)}
              {request.requestedByName ? ` · ${request.requestedByName}` : ""}
            </p>
          </div>

          {canHandle && moves.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {moves.map((move) => {
                const look = MOVE_LOOK[move];
                return (
                  <Button
                    key={move}
                    size="sm"
                    variant={look?.variant ?? "outline"}
                    onClick={() => onHandle(move)}
                  >
                    {look?.icon}
                    {t.request[MOVE_LABEL_KEY[move] ?? "handle"]}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>

        {request.reason ? (
          <div className="bg-muted/50 rounded-md p-3 text-sm">
            <p className="text-muted-foreground mb-1 text-xs font-medium">
              {t.request.reason}
            </p>
            <p className="whitespace-pre-line">{request.reason}</p>
          </div>
        ) : null}

        {/* What the family is being told, in the words they read on their
            phone — shown back to the desk so the two cannot drift. */}
        {request.readyAt || request.officeNote ? (
          <div
            className={cn(
              "rounded-md border p-3 text-sm",
              request.isOverdue && "border-destructive/40",
            )}
          >
            {request.readyAt ? (
              <p className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4 shrink-0" />
                {t.request.readyOn} {formatDate(request.readyAt, locale)}
              </p>
            ) : null}
            {request.officeNote ? (
              <p className="text-muted-foreground mt-1 whitespace-pre-line">
                {request.officeNote}
              </p>
            ) : null}
          </div>
        ) : null}

        {request.handledByName ? (
          <p className="text-muted-foreground text-xs">
            {interpolate(t.request.handledBy, { name: request.handledByName })}
            {request.collectedAt
              ? ` · ${interpolate(t.request.collectedOn, {
                  date: formatDate(request.collectedAt, locale),
                })}`
              : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span
          className={cn(
            "text-muted-foreground",
            tone === "danger" && "text-destructive",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              tone === "danger" && "text-destructive",
            )}
          >
            {value}
          </p>
          <p className="text-muted-foreground truncate text-sm">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
