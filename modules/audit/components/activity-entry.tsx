"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";

import { useI18n, useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatDateTime } from "@/lib/i18n/format";
import { ChangeList } from "@/modules/audit/components/change-list";
import type { ActivityAction } from "@/modules/audit/enums";
import type { ActivityEntry } from "@/modules/audit/queries";

/**
 * One line of the trail, openable to show what it changed.
 *
 * Collapsed by default and openable in place rather than in a dialog: reading a
 * trail is comparing neighbours — "she changed the fee at 9:04, he changed it
 * back at 9:11" — and a dialog puts one line on screen at a time, which is
 * exactly the wrong shape for the question being asked.
 */
export function ActivityEntryRow({ entry }: { entry: ActivityEntry }) {
  const t = useT();
  const { locale, fmt } = useI18n();
  const [open, setOpen] = React.useState(false);

  const fieldCount = entry.changes ? Object.keys(entry.changes).length : 0;
  const hasDetail = fieldCount > 0 || entry.metadata !== null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-border/60 border-b last:border-b-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
        <time
          dateTime={entry.createdAt.toISOString()}
          className="text-muted-foreground w-40 shrink-0 tabular-nums"
        >
          {formatDateTime(entry.createdAt, locale)}
        </time>

        <ActorName entry={entry} />

        <ActionBadge action={entry.action} />

        <EntityName entry={entry} />

        {hasDetail ? (
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground ms-auto inline-flex items-center gap-1 text-xs">
            <ChevronRightIcon
              className={`size-3.5 transition-transform rtl:rotate-180 ${open ? "rotate-90 rtl:-rotate-90" : ""}`}
            />
            {fieldCount === 1
              ? t.audit.oneChange
              : fieldCount > 1
                ? fmt(t.audit.changesCount, { count: fieldCount })
                : t.audit.what}
          </CollapsibleTrigger>
        ) : null}
      </div>

      <CollapsibleContent className="bg-muted/30 border-border/60 border-t px-3 py-3">
        <ChangeList changes={entry.changes} />
        <EntryMetadata entry={entry} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Who did it — the name as it read at the time, never as it reads now. */
function ActorName({ entry }: { entry: ActivityEntry }) {
  const t = useT();

  return (
    <span className="w-44 shrink-0 truncate font-medium">
      {entry.actorId === null ? (
        <span className="text-muted-foreground">
          {entry.actorLabel === "system" ? t.audit.systemActor : entry.actorLabel}
        </span>
      ) : (
        entry.actorLabel
      )}
    </span>
  );
}

/**
 * What it happened to — "Pupil · Yasmine Alaoui", linked when the record still
 * has a page to open. A deletion never links: the entry is the only copy left.
 */
function EntityName({ entry }: { entry: ActivityEntry }) {
  const t = useT();

  const type =
    t.auditOptions.entities[
      entry.entity as keyof typeof t.auditOptions.entities
    ] ?? entry.entity;

  const label = entry.entityLabel ?? entry.entityId?.slice(-6) ?? null;

  const body = (
    <>
      <span className="text-muted-foreground">{type}</span>
      {label ? (
        <>
          <span className="text-muted-foreground/50">·</span>
          <span className="font-medium">{label}</span>
        </>
      ) : null}
    </>
  );

  if (!entry.href) {
    return <span className="flex items-center gap-1.5 truncate">{body}</span>;
  }

  return (
    <Link
      href={entry.href}
      className="group flex items-center gap-1.5 truncate hover:underline"
      title={t.audit.openRecord}
    >
      {body}
      <ExternalLinkIcon className="text-muted-foreground size-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

/**
 * The colours say what happened before the words do: a deletion is the one a
 * reader is scanning for, and a creation is the one they are usually not.
 */
const ACTION_VARIANT: Record<
  ActivityAction,
  "default" | "secondary" | "destructive" | "outline"
> = {
  CREATE: "secondary",
  UPDATE: "outline",
  DELETE: "destructive",
  CREATE_MANY: "secondary",
  UPDATE_MANY: "outline",
  DELETE_MANY: "destructive",
  LOGIN: "outline",
  LOGIN_FAILED: "destructive",
  LOGIN_BLOCKED: "destructive",
  LOGOUT: "outline",
  DENIED: "destructive",
};

export function ActionBadge({ action }: { action: ActivityAction }) {
  const t = useT();

  return (
    <Badge variant={ACTION_VARIANT[action] ?? "outline"} className="shrink-0">
      {t.auditOptions.actions[action] ?? action}
    </Badge>
  );
}

/**
 * The extras a bulk write or a refusal carries: how many rows were touched,
 * which permission was refused. Rendered plainly rather than as raw JSON —
 * the reader is answering a question, not debugging.
 */
function EntryMetadata({ entry }: { entry: ActivityEntry }) {
  const t = useT();
  const { fmt } = useI18n();

  if (!entry.metadata) return null;

  const { count, permission, ids, truncated, ...rest } = entry.metadata as {
    count?: number;
    permission?: string;
    ids?: string[];
    truncated?: boolean;
  } & Record<string, unknown>;

  return (
    <div className="text-muted-foreground mt-2 space-y-1 text-xs">
      {typeof count === "number" ? (
        <p>{fmt(t.audit.affectedRows, { count })}</p>
      ) : null}
      {typeof permission === "string" ? (
        <p>{fmt(t.audit.deniedPermission, { permission })}</p>
      ) : null}
      {Array.isArray(ids) && ids.length > 0 ? (
        <p className="font-mono break-all">
          {ids.join(", ")}
          {truncated ? ` … (${fmt(t.audit.truncatedIds, { count: ids.length })})` : ""}
        </p>
      ) : null}
      {Object.entries(rest).map(([key, value]) => (
        <p key={key}>
          <span className="font-mono">{key}</span>:{" "}
          {typeof value === "object" ? JSON.stringify(value) : String(value)}
        </p>
      ))}
    </div>
  );
}
