"use client";

import { useT } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevoirsReview } from "@/modules/assessments/components/devoirs-review";
import { GenerateDialog } from "@/modules/assessments/components/generate-dialog";
import { SetDevoirDialog } from "@/modules/assessments/components/set-devoir-dialog";
import type {
  AssessmentTypeOption,
  ClassPapers,
  ClassOption,
  DevoirTarget,
  ProgrammeEntry,
  TermOption,
} from "@/modules/assessments/queries";
import type {
  ClassResults,
  ClassTermAverage,
} from "@/modules/bulletins/queries";
import type { ClassAttendance, RemarkRow } from "@/modules/classroom/queries";
import { ClassOverview } from "@/modules/classes/components/class-overview";
import { ClassRoster } from "@/modules/classes/components/class-roster";
import { TeachingPanel } from "@/modules/classes/components/teaching-panel";
import type {
  ClassDetail as ClassDetailData,
  ClassOverview as ClassOverviewData,
  TeachingGridRow,
} from "@/modules/classes/queries";
import { TimetableGrid } from "@/modules/timetable/components/timetable-grid";
import type { TimetableChoices } from "@/modules/timetable/components/timetable-grid";
import type { TimetableGrid as TimetableGridData } from "@/modules/timetable/queries";

/**
 * What the two create buttons on the paper tabs need.
 *
 * Assembled by the page from the assessments module's own reads and passed in as
 * one object rather than seven props: the two dialogs are the assessments
 * module's, and this component's job is to place them, not to know how their
 * options are gathered. Loaded only for a reader who may actually set a paper —
 * see the note on the prop.
 */
export type PaperCreation = {
  /** This niveau's classes, so the generator's LEVEL scope covers this one. */
  levelClasses: ClassOption[];
  terms: TermOption[];
  defaultTermId: string | null;
  /** Already clamped into the school year — see lib/school-year.ts. */
  defaultDate: string;
  /** Marked subjects per class, so the generator fills in without a round trip. */
  programmes: Record<string, ProgrammeEntry[]>;
  controlTypes: AssessmentTypeOption[];
  /** Only the kinds the school lets a teacher set — see AssessmentType. */
  devoirTypes: AssessmentTypeOption[];
  /** This class's own class-and-subject pairs — see `listDevoirTargets`. */
  devoirTargets: DevoirTarget[];
};

/**
 * A class, tab by tab: what is true of it, its pupils, its staffing, its week,
 * and the papers set against it.
 *
 * The middle three are the job of running a class, and they are done by
 * different people: the secretary seats pupils, the director assigns teachers,
 * whoever draws the timetable fills the grid. Tabs keep each of them one click
 * from the others without making any of them scroll past the other two.
 *
 * **The overview leads**, because opening a class to be told nothing about it is
 * a wasted screen: the roster used to open first, which answered "who is in it"
 * and left "is it full, is it staffed, is its week complete" to three more
 * clicks. It is also the only tab that says anything about the *niveau*, which
 * is what most questions about a class are really asked against — see
 * `ClassOverview`.
 *
 * The two paper tabs carry their own create button rather than one in the page
 * header. A header button would have to ask which class it meant, and the answer
 * is on screen; put on the tab, the class is the route's and the only question
 * left is the paper. Contrôles go through the generator — a round is set for a
 * whole niveau at once, which is why it offers this class *or* its niveau — and a
 * devoir is one piece of work for one class, so it does not.
 */
export function ClassDetail({
  schoolClass,
  overview,
  results,
  termAverages,
  attendance,
  remarks,
  candidates,
  teachingGrid,
  timetable,
  timetableChoices,
  controls,
  devoirs,
  paperCreation,
  permissions,
}: {
  schoolClass: ClassDetailData;
  /** This class and its niveau, for the first tab. Null when it cannot be read. */
  overview: ClassOverviewData | null;
  /** The term's results. Null for a reader who may not see marks, or a term
   *  with no bulletins computed — see `loadClassResults`. */
  results: ClassResults | null;
  /** The moyenne term by term, for the overview's trend. Empty when unreadable. */
  termAverages: ClassTermAverage[];
  /** The class's year of registers. Null for a reader without the code. */
  attendance: ClassAttendance | null;
  /** The class's carnet, newest first. Empty for a reader who may not read it. */
  remarks: RemarkRow[];
  /** The class's programme with its current holders — see `loadTeachingGrid`. */
  teachingGrid: TeachingGridRow[];
  candidates: { id: string; enrollmentId: string; label: string }[];
  timetable: TimetableGridData | null;
  timetableChoices: TimetableChoices | null;
  /** Null for a reader without `assessment.view` — the tabs are not drawn. */
  controls: ClassPapers | null;
  devoirs: ClassPapers | null;
  /**
   * What the two create buttons need. Null for a reader who may look at papers
   * but not set them — the button is then not drawn at all, rather than drawn
   * and refused.
   */
  paperCreation: PaperCreation | null;
  permissions: {
    canRoster: boolean;
    canAssignTeacher: boolean;
    canManageTimetable: boolean;
    canValidatePapers: boolean;
    canReweighPapers: boolean;
    /** ASSESSMENT_MANAGE: generating a round is the office's decision. */
    canGeneratePapers: boolean;
  };
}) {
  const t = useT();

  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="mb-4">
        {overview ? (
          <TabsTrigger value="overview">{t.schoolClass.tabOverview}</TabsTrigger>
        ) : null}
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

      {overview ? (
        <TabsContent value="overview">
          <ClassOverview
            overview={overview}
            results={results}
            termAverages={termAverages}
            attendance={attendance}
            // The same week the tab next door draws, read as a load per day
            // rather than a grid — see `loadByDay`.
            timetable={timetable}
            remarks={remarks}
            classCode={schoolClass.code}
          />
        </TabsContent>
      ) : null}

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
          {paperCreation && permissions.canGeneratePapers ? (
            <div className="mb-4 flex justify-end">
              {/* This class or its niveau, and deliberately not the year: the
                button is on 3AP-A, so generating for the whole school from it
                would be a scope nobody clicking it meant. See `scopes`. */}
              <GenerateDialog
                classes={paperCreation.levelClasses}
                terms={paperCreation.terms}
                types={paperCreation.controlTypes}
                programmes={paperCreation.programmes}
                defaultClassId={schoolClass.id}
                defaultTermId={paperCreation.defaultTermId}
                defaultDate={paperCreation.defaultDate}
                scopes={["CLASS", "LEVEL"]}
              />
            </div>
          ) : null}
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
          {paperCreation && paperCreation.devoirTargets.length > 0 ? (
            <div className="mb-4 flex justify-end">
              {/* Already narrowed to this class's own subject pairs — see
                `listDevoirTargets`. A devoir is one piece of work for one class,
                so there is no niveau-wide option to offer. */}
              <SetDevoirDialog
                targets={paperCreation.devoirTargets}
                terms={paperCreation.terms}
                types={paperCreation.devoirTypes}
                defaultDate={paperCreation.defaultDate}
              />
            </div>
          ) : null}
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
