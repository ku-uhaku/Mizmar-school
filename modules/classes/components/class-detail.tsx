"use client";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  permissions,
}: {
  schoolClass: ClassDetailData;
  /** The class's programme with its current holders — see `loadTeachingGrid`. */
  teachingGrid: TeachingGridRow[];
  candidates: { id: string; enrollmentId: string; label: string }[];
  timetable: TimetableGridData | null;
  timetableChoices: TimetableChoices | null;
  permissions: {
    canRoster: boolean;
    canAssignTeacher: boolean;
    canManageTimetable: boolean;
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
          choices={{
            subjects: timetableChoices?.subjects ?? [],
            teachers: timetableChoices?.teachers ?? [],
          }}
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
    </Tabs>
  );
}
