"use client";

import { ArrowRightIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import type { ChangeSet } from "@/lib/audit";

/**
 * What one entry actually changed, field by field.
 *
 * ── Why the field names are not translated ───────────────────────────────────
 * They are shown exactly as the schema spells them — `feeAmount`, not "Amount".
 * The trail is evidence: two readers looking at the same entry in two languages
 * have to be looking at the same field, and a column whose name is translated
 * in one dictionary and not another quietly becomes two different facts. It
 * also means a field nobody has written a label for still reads correctly,
 * which matters for a list that covers eighty tables.
 */
export function ChangeList({ changes }: { changes: ChangeSet | null }) {
  const t = useT();

  if (!changes || Object.keys(changes).length === 0) {
    return <p className="text-muted-foreground text-sm">{t.audit.noDetail}</p>;
  }

  return (
    <dl className="grid gap-1.5 text-sm">
      {Object.entries(changes).map(([field, change]) => (
        <div
          key={field}
          className="grid items-baseline gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(8rem,14rem)_1fr]"
        >
          <dt className="text-muted-foreground font-mono text-xs">{field}</dt>
          <dd className="flex flex-wrap items-baseline gap-2">
            <Value value={change.from} muted />
            <ArrowRightIcon className="text-muted-foreground size-3 shrink-0 rtl:rotate-180" />
            <Value value={change.to} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One side of a change.
 *
 * An empty column reads as "—" rather than as the word "null": the reader is a
 * director, and the distinction they need is "there was nothing there before",
 * which the dash says and the database's vocabulary does not.
 */
function Value({ value, muted = false }: { value: unknown; muted?: boolean }) {
  const t = useT();

  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (value === "•••") {
    return (
      <span className="text-muted-foreground italic">{t.audit.redacted}</span>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span className={muted ? "text-muted-foreground" : undefined}>
        {value ? t.common.yes : t.common.no}
      </span>
    );
  }

  return (
    <span
      className={`break-all ${muted ? "text-muted-foreground line-through decoration-muted-foreground/40" : "font-medium"}`}
    >
      {String(value)}
    </span>
  );
}
