"use client";

import { BookOpenIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TeachingGrid } from "@/modules/classes/components/teaching-grid";
import type { ClassDetail, TeachingGridRow } from "@/modules/classes/queries";

type Choices = {
  teachers: { id: string; label: string }[];
};

/**
 * Who teaches what in this class.
 *
 * Separate from the timetable on purpose: this answers "who is responsible for
 * Maths in 2BAC-SM-B" — what mark entry and report cards read — while the grid
 * answers "when and where". One assignment covers many lessons, which is why
 * assigning a teacher here fills the timetable dialog in rather than the other
 * way round.
 *
 * ── One programme, edited in place ──────────────────────────────────────────
 * This panel used to carry two ways of saying the same thing: the programme
 * grid below, and above it a list of assignments with an "assign a teacher"
 * dialog behind a plus button. Two controls over one table is two places to
 * look and two ways for the screen to disagree with itself — and the dialog was
 * the slower of them, four fields and a save for a decision the grid makes with
 * one click on the row that is already in front of you.
 *
 * So the grid is the whole panel. Each row saves itself; see `TeachingGrid`.
 */
export function TeachingPanel({
  schoolClass,
  grid,
  choices,
  canManage,
}: {
  schoolClass: ClassDetail;
  /** The class's programme with its current holders — see `loadTeachingGrid`. */
  grid: TeachingGridRow[];
  choices: Choices;
  canManage: boolean;
}) {
  const t = useT();

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t.schoolClass.teaching}</CardTitle>
        <CardDescription>{t.schoolClass.teachingHint}</CardDescription>
      </CardHeader>

      <CardContent>
        {/*
          No rows means the level has no marked programme yet — nothing to staff
          rather than nothing staffed, which is a configuration job and not one
          that can be done from here.
        */}
        {grid.length === 0 ? (
          <EmptyState
            icon={<BookOpenIcon className="size-5" />}
            title={t.schoolClass.emptyTeaching}
            description={t.schoolClass.emptyTeachingHint}
          />
        ) : (
          <TeachingGrid
            schoolClassId={schoolClass.id}
            rows={grid}
            teachers={choices.teachers}
            canManage={canManage}
          />
        )}
      </CardContent>
    </Card>
  );
}
