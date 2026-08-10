"use client";

import * as React from "react";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import type { SetupState } from "@/modules/setup/components/use-setup-state";

/** What is about to be written, counted from the answers rather than promised. */
export function ReviewStep({ setup }: { setup: SetupState }) {
  const t = useT();
  const s = setup.summary;

  const rows: { label: string; count: number }[] = [
    { label: t.setup.review.cycles, count: s.cycles },
    { label: t.setup.review.levels, count: s.levels },
    { label: t.setup.review.tracks, count: s.tracks },
    { label: t.setup.review.subjects, count: s.subjects },
    { label: t.setup.review.programme, count: s.programme },
    { label: t.setup.review.terms, count: s.terms },
    { label: t.setup.review.rooms, count: s.rooms },
    { label: t.setup.review.offerings, count: s.offerings },
    { label: t.setup.review.classes, count: s.classes },
    { label: t.setup.review.groups, count: s.groups },
    { label: t.setup.review.feeTypes, count: s.feeTypes },
    { label: t.setup.review.feeRates, count: s.feeRates },
    { label: t.setup.review.discounts, count: s.discounts },
  ];

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        {setup.mode === "new" ? t.setup.review.willCreate : t.setup.review.willUpdate}
      </p>

      {total === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          {t.setup.review.nothingToDo}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows
            .filter((row) => row.count > 0)
            .map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span className="text-sm">{row.label}</span>
                <Badge variant="secondary">{row.count}</Badge>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
