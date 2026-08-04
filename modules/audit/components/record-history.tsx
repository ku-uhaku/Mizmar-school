"use client";

import Link from "next/link";
import { ScrollTextIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActivityEntryRow } from "@/modules/audit/components/activity-entry";
import type { ActivityEntry } from "@/modules/audit/queries";

/**
 * One record's own timeline, on the screen that record lives on.
 *
 * The whole trail answers "what happened today"; this answers "what happened to
 * *this*", which is the question actually asked out loud — by a parent about a
 * fee, by a teacher about a mark. Same rows, same rendering: a reader who
 * learns to read one has learnt to read the other.
 *
 * Rendered only for a reader who may see the trail — the page decides that, and
 * passes nothing at all otherwise.
 */
export function RecordHistory({
  entries,
  entity,
  entityId,
}: {
  entries: ActivityEntry[];
  /** The Prisma model name, so "see everything" opens the log pre-filtered. */
  entity: string;
  entityId: string;
}) {
  const t = useT();

  return (
    <Card className="py-0 pt-6">
      <CardHeader className="pb-4">
        <CardTitle>{t.audit.history}</CardTitle>
        <CardDescription>{t.audit.historyHint}</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/audit?entity=${encodeURIComponent(entity)}&entityId=${encodeURIComponent(entityId)}`}
            >
              {t.audit.seeAll}
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {entries.length === 0 ? (
          <EmptyState
            icon={<ScrollTextIcon className="size-5" />}
            title={t.audit.noHistory}
          />
        ) : (
          <div className="border-border/60 border-t">
            {entries.map((entry) => (
              <ActivityEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
