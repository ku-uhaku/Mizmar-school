"use client";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevoirsReview } from "@/modules/assessments/components/devoirs-review";
import type { ClassPapers } from "@/modules/assessments/queries";
import { ClassRoster } from "@/modules/classes/components/class-roster";
import { TeachingPanel } from "@/modules/classes/components/teaching-panel";
import type {
  ClassDetail as ClassDetailData,
  TeachingGridRow,
} from "@/modules/classes/queries";
import { TimetableGrid } from "@/modules/timetable/components/timetable-grid";
import type { TimetableChoices } from "@/modules/timetable/components/timetable-grid";
import type { TimetableGrid as TimetableGridData } from "@/modules/timetable/queries";

/**
 * A class in three tabs — its pupils, its staffing, its week.
 *
 * The three are the whole job of running a class, and they are done by
 * different people: the secretary seats pupils, the director assigns teachers,
 * whoever draws the timetable fills the grid. Tabs keep each of them one click
 * from the others without making any of them scroll past the other two.
 */
export function ClassDetail({
  schoolClass,
  candidates,
  teachingGrid,
  timetable,
  timetableChoices,
  controls,
  devoirs,
  permissions,
}: {
  schoolClass: ClassDetailData;
  /** The class's programme with its current holders — see `loadTeachingGrid`. */
  teachingGrid: TeachingGridRow[];
  candidates: { id: string; enrollmentId: string; label: string }[];
  timetable: TimetableGridData | null;
  timetableChoices: TimetableChoices | null;
  /** Null for a reader without `assessment.view` — the tabs are not drawn. */
  controls: ClassPapers | null;
  devoirs: ClassPapers | null;
  permissions: {
    canRoster: boolean;
    canAssignTeacher: boolean;
    canManageTimetable: boolean;
    canValidatePapers: boolean;
    canReweighPapers: boolean;
  };
}) {
  const t = useT();

  return (
    <Tabs defaultValue="roster">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="roster">
          {t.schoolClass.tabRoster}
          <Badge variant="secondary" className="ms-1.5 tabular-nums">
            {schoolClass.enrolled}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="teaching">
          {t.schoolClass.tabTeaching}
          <Badge variant="secondary" className="ms-1.5 tabular-nums">
            {schoolClass.assignmentCount}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="timetable">
          {t.schoolClass.tabTimetable}
          <Badge variant="secondary" className="ms-1.5 tabular-nums">
            {schoolClass.timetableCount}
          </Badge>
        </TabsTrigger>
        {/* No count on these two: the list behind them is capped and filtered,
          so a badge would be a number that disagrees with what the tab opens
          onto. The "à valider" button inside each carries the count that
          matters. */}
        {controls ? (
          <TabsTrigger value="controls">{t.schoolClass.tabControls}</TabsTrigger>
        ) : null}
        {devoirs ? (
          <TabsTrigger value="devoirs">{t.schoolClass.tabDevoirs}</TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="roster">
        <ClassRoster
          schoolClass={schoolClass}
          candidates={candidates}
          canManage={permissions.canRoster}
        />
      </TabsContent>

      <TabsContent value="teaching">
        <TeachingPanel
          schoolClass={schoolClass}
          grid={teachingGrid}
          choices={{ teachers: timetableChoices?.teachers ?? [] }}
          canManage={permissions.canAssignTeacher}
        />
      </TabsContent>

      <TabsContent value="timetable">
        {timetable && timetableChoices ? (
          <TimetableGrid
            grid={timetable}
            schoolClassId={schoolClass.id}
            choices={timetableChoices}
            canManage={permissions.canManageTimetable}
          />
        ) : null}
      </TabsContent>

      {/*
        The same review the vie scolaire uses, with the class fixed by the route
        rather than picked. Each list carries its own query-parameter prefix so
        filtering the contrôles does not reach into the devoirs beside them —
        and so a filtered tab is still a link somebody can send.
      */}
      {controls ? (
        <TabsContent value="controls">
          <DevoirsReview
            kind="CONTROLE"
            paramPrefix="c_"
            showClassFilter={false}
            assessments={controls.assessments}
            choices={controls.choices}
            terms={controls.terms}
            filters={controls.filters}
            canValidate={permissions.canValidatePapers}
            canReweigh={permissions.canReweighPapers}
          />
        </TabsContent>
      ) : null}

      {devoirs ? (
        <TabsContent value="devoirs">
          <DevoirsReview
            kind="DEVOIR"
            paramPrefix="d_"
            showClassFilter={false}
            assessments={devoirs.assessments}
            choices={devoirs.choices}
            terms={devoirs.terms}
            filters={devoirs.filters}
            canValidate={permissions.canValidatePapers}
            canReweigh={permissions.canReweighPapers}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
