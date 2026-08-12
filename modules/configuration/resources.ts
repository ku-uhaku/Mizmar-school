import {
  COEFFICIENT_MAX,
  COEFFICIENT_MIN,
  EDUCATION_CYCLES,
} from "@/modules/academics/enums";
import {
  BILLING_CYCLES,
  DISCOUNT_KINDS,
  DISCOUNT_REASONS,
  FEE_KINDS,
} from "@/modules/billing/enums";
import { GROUP_PURPOSES } from "@/modules/classes/enums";
import { CATEGORY_KINDS } from "@/modules/treasury/enums";
import { ROOM_KINDS } from "@/modules/facilities/enums";
import { SCHEDULE_DIRECTIONS } from "@/modules/transport/enums";
import { TERM_STATUSES } from "@/modules/school-years/enums";
import { SUPPLY_CATEGORIES } from "@/modules/supplies/enums";
import { SUPPLIER_KINDS } from "@/modules/treasury/enums";
import { SCHOOL_WEEK_PARITIES } from "@/modules/timetable/enums";
import {
  ABSENCE_KINDS,
  DAY_SESSIONS,
  HOLIDAY_KINDS,
  SCHEDULE_KINDS,
  TEACHING_DAYS,
} from "@/modules/timetable/enums";
import type {
  ResourceDef,
  ScopeGroupDef,
  SectionDef,
} from "@/modules/configuration/types";

/**
 * Every configurable table, described once.
 *
 * Adding a configuration screen is adding an entry here — the tabs, the table,
 * the create/edit dialog, the validation and the delete confirmation are all
 * generated from it. Nothing else needs editing except the labels in `i18n/`.
 *
 * Client-safe: this file is imported by the dialog to build its form. The
 * database side of a resource (what it scopes to, what it injects on create)
 * lives in `schema.server.ts`, keyed by the same `id`.
 */

/** Top-level horizontal tabs, in order. */
export const SECTIONS: SectionDef[] = [
  // First, because it is the section that changes what the others mean: the
  // grading scale, the teaching week and the currency are read by every screen
  // the remaining sections configure.
  { id: "school", labelKey: "school" },
  { id: "academics", labelKey: "academics" },
  { id: "facilities", labelKey: "facilities" },
  { id: "year", labelKey: "year" },
  { id: "classes", labelKey: "classes" },
  { id: "billing", labelKey: "billing" },
  { id: "treasury", labelKey: "treasury" },
  // Last, and only the horaires: the quartiers stay under Établissement, where
  // an address belongs — see the note on the neighbourhoods resource below.
  { id: "logistique", labelKey: "logistique" },
];

/**
 * The two tabs above `SECTIONS`. "École année" is the sections whose tables
 * are redrawn every September — the calendar and the classes; everything
 * else — the establishment, the academic structure, the price lists, the
 * caisse, the logistics catalogues — sits under "Configuration générale"
 * because it is set up once and rarely touched again, even where one table
 * inside it (a fee rate, say) happens to be year-scoped underneath.
 */
export const SCOPE_GROUPS: ScopeGroupDef[] = [
  {
    id: "general",
    labelKey: "general",
    sectionIds: [
      "school",
      "academics",
      "facilities",
      "billing",
      "treasury",
      "logistique",
    ],
  },
  {
    id: "year",
    labelKey: "year",
    sectionIds: ["year", "classes"],
  },
];

/** Shared trailing fields — every resource that has them wants them last. */
const IS_ACTIVE = {
  name: "isActive",
  type: "boolean",
  labelKey: "isActive",
  defaultValue: true,
  inTable: true,
} as const;

const POSITION = {
  name: "position",
  type: "number",
  labelKey: "position",
  hintKey: "position",
  min: 0,
  defaultValue: 0,
} as const;

const NAME_AR = {
  name: "nameAr",
  type: "text",
  labelKey: "nameAr",
  maxLength: 120,
} as const;

const MASSAR_CODE = {
  name: "massarCode",
  type: "text",
  labelKey: "massarCode",
  hintKey: "massarCode",
  maxLength: 32,
  dir: "ltr",
  inTable: true,
} as const;

/** Vertical tabs within each section, in order. */
export const RESOURCES: ResourceDef[] = [
  // ── Structure pédagogique ─────────────────────────────────────────────────
  {
    id: "education-levels",
    section: "academics",
    labelKey: "educationLevels",
    scope: "SCHOOL",
    labelFields: ["name"],
    fields: [
      {
        name: "cycle",
        type: "select",
        labelKey: "cycle",
        options: EDUCATION_CYCLES,
        optionsKey: "cycles",
        required: true,
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      POSITION,
      IS_ACTIVE,
    ],
  },
  {
    id: "levels",
    section: "academics",
    labelKey: "levels",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "educationLevelId",
        type: "reference",
        labelKey: "educationLevel",
        referenceTo: "education-levels",
        required: true,
        inTable: true,
      },
      {
        name: "code",
        type: "text",
        labelKey: "code",
        hintKey: "levelCode",
        required: true,
        maxLength: 16,
        dir: "ltr",
        placeholder: "2BAC",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      {
        name: "gradeYear",
        type: "number",
        labelKey: "gradeYear",
        hintKey: "gradeYear",
        required: true,
        min: 1,
        max: 12,
        defaultValue: 1,
      },
      MASSAR_CODE,
      POSITION,
      IS_ACTIVE,
    ],
  },
  {
    id: "tracks",
    section: "academics",
    labelKey: "tracks",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "levelId",
        type: "reference",
        labelKey: "level",
        hintKey: "trackLevel",
        referenceTo: "levels",
        required: true,
        inTable: true,
      },
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 16,
        dir: "ltr",
        placeholder: "SM-A",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      MASSAR_CODE,
      POSITION,
      IS_ACTIVE,
    ],
  },
  {
    id: "subjects",
    section: "academics",
    labelKey: "subjects",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 16,
        dir: "ltr",
        placeholder: "MATH",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      { name: "shortName", type: "text", labelKey: "shortName", maxLength: 16 },
      {
        name: "parentId",
        type: "reference",
        labelKey: "parentSubject",
        hintKey: "parentSubject",
        referenceTo: "subjects",
        nullable: true,
        inTable: true,
      },
      MASSAR_CODE,
      { name: "colorHex", type: "color", labelKey: "colorHex" },
      { name: "isLanguage", type: "boolean", labelKey: "isLanguage" },
      { name: "requiresLab", type: "boolean", labelKey: "requiresLab" },
      IS_ACTIVE,
    ],
  },
  {
    id: "assessment-types",
    section: "academics",
    labelKey: "assessmentTypes",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 16,
        dir: "ltr",
        placeholder: "CC",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      {
        name: "defaultCoefficient",
        type: "number",
        labelKey: "defaultCoefficient",
        hintKey: "defaultCoefficient",
        min: 1,
        max: 20,
        defaultValue: 1,
        inTable: true,
      },
      {
        name: "defaultMaxScore",
        type: "number",
        labelKey: "defaultMaxScore",
        hintKey: "defaultMaxScore",
        min: 1,
        max: 100,
        defaultValue: 20,
        inTable: true,
      },
      {
        name: "countsTowardAverage",
        type: "boolean",
        labelKey: "countsTowardAverage",
        hintKey: "countsTowardAverage",
        defaultValue: true,
        inTable: true,
      },
      {
        name: "gradesWholeSubject",
        type: "boolean",
        labelKey: "gradesWholeSubject",
        hintKey: "gradesWholeSubject",
        defaultValue: false,
        inTable: true,
      },
      {
        name: "allowTeacherCreate",
        type: "boolean",
        labelKey: "allowTeacherCreate",
        hintKey: "allowTeacherCreate",
        defaultValue: false,
        inTable: true,
      },
      { name: "colorHex", type: "color", labelKey: "colorHex" },
      POSITION,
      IS_ACTIVE,
    ],
  },
  {
    id: "programme",
    section: "academics",
    labelKey: "programme",
    scope: "SCHOOL",
    labelFields: ["coefficient"],
    fields: [
      {
        name: "levelId",
        type: "reference",
        labelKey: "level",
        referenceTo: "levels",
        required: true,
        inTable: true,
      },
      {
        name: "trackId",
        type: "reference",
        labelKey: "track",
        hintKey: "programmeTrack",
        referenceTo: "tracks",
        nullable: true,
        inTable: true,
      },
      {
        name: "subjectId",
        type: "reference",
        labelKey: "subject",
        referenceTo: "subjects",
        required: true,
        inTable: true,
      },
      {
        name: "coefficient",
        type: "number",
        labelKey: "coefficient",
        hintKey: "coefficient",
        required: true,
        // From the module that owns the column rather than spelled again here,
        // so the form and the rule cannot drift apart.
        min: COEFFICIENT_MIN,
        max: COEFFICIENT_MAX,
        defaultValue: 1,
        inTable: true,
      },
      {
        name: "weeklyMinutes",
        type: "number",
        labelKey: "weeklyMinutes",
        hintKey: "weeklyMinutes",
        min: 0,
        max: 3000,
        inTable: true,
      },
      { name: "isGraded", type: "boolean", labelKey: "isGraded", defaultValue: true },
      { name: "isEliminatory", type: "boolean", labelKey: "isEliminatory" },
      POSITION,
    ],
  },

  /*
    Who may teach what.

    Under Structure pédagogique rather than beside the staff file, because the
    question it answers is "is there anybody in this building who can take 4AP
    maths" — a curriculum question the head of studies asks while looking at the
    subjects, not a payroll one. The hours somebody may be given *are* payroll,
    and live on their contract; see Staff.maxWeeklyMinutes.
  */
  {
    id: "teacher-subjects",
    section: "academics",
    labelKey: "teacherSubjects",
    scope: "SCHOOL",
    labelFields: ["subjectId"],
    fields: [
      {
        name: "teacherId",
        type: "reference",
        labelKey: "teacher",
        referenceTo: "@teachers",
        required: true,
        inTable: true,
      },
      {
        name: "subjectId",
        type: "reference",
        labelKey: "subject",
        referenceTo: "subjects",
        required: true,
        inTable: true,
      },
      {
        name: "preferenceRank",
        type: "number",
        labelKey: "preferenceRank",
        hintKey: "preferenceRank",
        min: 0,
        max: 9,
        defaultValue: 0,
        inTable: true,
      },
      IS_ACTIVE,
      { name: "notes", type: "textarea", labelKey: "notes", maxLength: 500, wide: true },
    ],
  },

  // ── Établissement ─────────────────────────────────────────────────────────
  {
    id: "rooms",
    section: "facilities",
    labelKey: "rooms",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "B12",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", maxLength: 120, inTable: true },
      {
        name: "kind",
        type: "select",
        labelKey: "roomKind",
        options: ROOM_KINDS,
        optionsKey: "roomKinds",
        defaultValue: "CLASSROOM",
        required: true,
        inTable: true,
      },
      { name: "building", type: "text", labelKey: "building", maxLength: 80, inTable: true },
      { name: "floor", type: "number", labelKey: "floor", min: -5, max: 50 },
      { name: "capacity", type: "number", labelKey: "capacity", min: 0, max: 2000, inTable: true },
      IS_ACTIVE,
      { name: "notes", type: "textarea", labelKey: "notes", maxLength: 500, wide: true },
    ],
  },

  /*
    Towns, under Établissement rather than a geography section of its own: one
    list does not earn a tab, and the place a school looks for "how we spell
    Casablanca" is the same place it sets its own address.
  */
  {
    id: "cities",
    section: "school",
    labelKey: "cities",
    scope: "SCHOOL",
    labelFields: ["name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "CASA",
        inTable: true,
      },
      {
        name: "name",
        type: "text",
        labelKey: "name",
        required: true,
        maxLength: 120,
        inTable: true,
      },
      NAME_AR,
      {
        name: "region",
        type: "text",
        labelKey: "region",
        hintKey: "region",
        maxLength: 120,
        inTable: true,
      },
      IS_ACTIVE,
    ],
  },

  /*
    Quartiers. Under Établissement beside the towns they belong to rather than
    under a transport section: a quartier is an address, and the bus is only the
    first thing to need one. See the note on Neighbourhood about why it is not
    the same thing as a TransportZone.
  */
  {
    id: "neighbourhoods",
    section: "school",
    labelKey: "neighbourhoods",
    scope: "SCHOOL",
    labelFields: ["name"],
    fields: [
      {
        name: "cityId",
        type: "reference",
        labelKey: "city",
        referenceTo: "cities",
        required: true,
        inTable: true,
      },
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "MAARIF",
        inTable: true,
      },
      {
        name: "name",
        type: "text",
        labelKey: "name",
        required: true,
        maxLength: 120,
        inTable: true,
      },
      NAME_AR,
      {
        name: "landmark",
        type: "text",
        labelKey: "landmark",
        hintKey: "landmark",
        maxLength: 160,
        inTable: true,
      },
      IS_ACTIVE,
    ],
  },

  // ── Année scolaire ────────────────────────────────────────────────────────
  /*
    Vacances and jours fériés. Under the year rather than the school because the
    dates move every year, and last year's calendar has to stay readable after
    this year's is entered — see prisma/schema/timetable/school-holiday.prisma.
  */
  {
    id: "holidays",
    section: "year",
    labelKey: "holidays",
    scope: "YEAR",
    labelFields: ["name"],
    fields: [
      {
        name: "name",
        type: "text",
        labelKey: "name",
        required: true,
        maxLength: 120,
        inTable: true,
      },
      NAME_AR,
      {
        name: "kind",
        type: "select",
        labelKey: "holidayKind",
        options: HOLIDAY_KINDS,
        optionsKey: "holidayKinds",
        defaultValue: "SCHOOL_HOLIDAY",
        required: true,
        inTable: true,
      },
      {
        name: "startDate",
        type: "date",
        labelKey: "startDate",
        required: true,
        inTable: true,
      },
      {
        name: "endDate",
        type: "date",
        labelKey: "endDate",
        hintKey: "holidayEnd",
        required: true,
        inTable: true,
      },
      { name: "notes", type: "textarea", labelKey: "notes", maxLength: 500, wide: true },
    ],
  },

  /*
    Teacher absences. A list rather than a screen of its own because it is the
    same four fields every time — who, from when, to when, and who is covering —
    and the generic CRUD renders that better than a bespoke page would.

    School-scoped, not year-scoped: an absence is a date, and which year it
    falls in follows from the date. See prisma/schema/timetable/teacher-absence.prisma
    for why it is one row rather than one per uncovered lesson.
  */
  {
    id: "teacher-absences",
    section: "year",
    labelKey: "teacherAbsences",
    scope: "SCHOOL",
    labelFields: ["startDate"],
    fields: [
      {
        name: "teacherId",
        type: "reference",
        labelKey: "teacher",
        referenceTo: "@teachers",
        required: true,
        inTable: true,
      },
      {
        name: "startDate",
        type: "date",
        labelKey: "startDate",
        required: true,
        inTable: true,
      },
      {
        name: "endDate",
        type: "date",
        labelKey: "endDate",
        hintKey: "holidayEnd",
        required: true,
        inTable: true,
      },
      {
        name: "kind",
        type: "select",
        labelKey: "absenceKind",
        options: ABSENCE_KINDS,
        optionsKey: "absenceKinds",
        defaultValue: "OTHER",
        required: true,
        inTable: true,
      },
      {
        name: "substituteId",
        type: "reference",
        labelKey: "substitute",
        hintKey: "substitute",
        referenceTo: "@teachers",
        nullable: true,
        inTable: true,
      },
      { name: "notes", type: "textarea", labelKey: "notes", maxLength: 500, wide: true },
    ],
  },

  {
    id: "terms",
    section: "year",
    labelKey: "terms",
    scope: "YEAR",
    labelFields: ["name"],
    fields: [
      {
        name: "number",
        type: "number",
        labelKey: "termNumber",
        hintKey: "termNumber",
        required: true,
        min: 1,
        max: 3,
        defaultValue: 1,
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 60, inTable: true },
      NAME_AR,
      MASSAR_CODE,
      { name: "startDate", type: "date", labelKey: "startDate", required: true, inTable: true },
      { name: "endDate", type: "date", labelKey: "endDate", required: true, inTable: true },
      {
        name: "status",
        type: "select",
        labelKey: "status",
        options: TERM_STATUSES,
        optionsKey: "termStatuses",
        defaultValue: "PLANNED",
        required: true,
        inTable: true,
      },
    ],
  },
  {
    id: "time-slots",
    section: "year",
    labelKey: "timeSlots",
    scope: "YEAR",
    labelFields: ["startTime", "endTime"],
    fields: [
      {
        name: "dayOfWeek",
        type: "select",
        labelKey: "dayOfWeek",
        hintKey: "dayOfWeek",
        options: TEACHING_DAYS.map(String),
        optionsKey: "days",
        defaultValue: "1",
        required: true,
        inTable: true,
      },
      {
        name: "session",
        type: "select",
        labelKey: "session",
        options: DAY_SESSIONS,
        optionsKey: "sessions",
        defaultValue: "MORNING",
        required: true,
        inTable: true,
      },
      { name: "startTime", type: "time", labelKey: "startTime", required: true, dir: "ltr", inTable: true },
      { name: "endTime", type: "time", labelKey: "endTime", required: true, dir: "ltr", inTable: true },
      {
        name: "scheduleKind",
        type: "select",
        labelKey: "scheduleKind",
        hintKey: "scheduleKind",
        options: SCHEDULE_KINDS,
        optionsKey: "scheduleKinds",
        defaultValue: "STANDARD",
        required: true,
        inTable: true,
      },
      { name: "isBreak", type: "boolean", labelKey: "isBreak", hintKey: "isBreak" },
      POSITION,
      IS_ACTIVE,
    ],
  },

  // ── Classes ───────────────────────────────────────────────────────────────
  /*
    Les semaines de l'année. Generated rather than typed — see the button on the
    timetable screen — but editable here, because no rule survives a real
    calendar: a fortnight lost to exams is renumbered by hand, and a rotation
    that resumes on the wrong foot is one flipped parity.
  */
  {
    id: "school-weeks",
    section: "year",
    labelKey: "schoolWeeks",
    scope: "YEAR",
    labelFields: ["number"],
    fields: [
      { name: "number", type: "number", labelKey: "weekNumber", hintKey: "weekNumber", required: true, min: 1, max: 60, inTable: true },
      { name: "startsOn", type: "date", labelKey: "startsOn", required: true, inTable: true },
      { name: "endsOn", type: "date", labelKey: "endsOn", required: true, inTable: true },
      {
        name: "parity",
        type: "select",
        labelKey: "weekParity",
        hintKey: "weekParity",
        options: SCHOOL_WEEK_PARITIES,
        optionsKey: "weekParities",
        defaultValue: "A",
        required: true,
        inTable: true,
      },
      { name: "label", type: "text", labelKey: "weekLabel", hintKey: "weekLabel", maxLength: 120, inTable: true },
    ],
  },

  /*
    Les horaires des enseignants — when each one does *not* work.
    A hard constraint: `findClash` refuses a lesson placed in a blocked period,
    exactly as it refuses a teacher already booked. A day off sick is a
    TeacherAbsence instead; this is the standing arrangement.
  */
  {
    id: "teacher-unavailability",
    section: "year",
    labelKey: "teacherUnavailability",
    scope: "YEAR",
    labelFields: ["teacherId"],
    fields: [
      { name: "teacherId", type: "reference", labelKey: "teacher", referenceTo: "@teachers", required: true, inTable: true },
      { name: "timeSlotId", type: "reference", labelKey: "timeSlot", hintKey: "timeSlot", referenceTo: "@slots", required: true, inTable: true },
      { name: "reason", type: "text", labelKey: "unavailabilityReason", hintKey: "unavailabilityReason", maxLength: 200, inTable: true, wide: true },
    ],
  },

  {
    id: "level-offerings",
    section: "classes",
    labelKey: "levelOfferings",
    scope: "YEAR",
    /*
      Unused: `loadChoices` intercepts this resource and builds the label from
      the level's name and the filière's, which `labelFields` cannot reach
      across a join. Left as `["id"]` — the fallback `labelOf` would produce
      anyway — rather than a plausible-looking column name that would quietly
      become the label if the loader were ever removed.
    */
    labelFields: ["id"],
    fields: [
      {
        name: "levelId",
        type: "reference",
        labelKey: "level",
        referenceTo: "levels",
        required: true,
        inTable: true,
      },
      {
        name: "trackId",
        type: "reference",
        labelKey: "track",
        hintKey: "offeringTrack",
        referenceTo: "tracks",
        nullable: true,
        inTable: true,
      },
      {
        name: "plannedCapacity",
        type: "number",
        labelKey: "plannedCapacity",
        hintKey: "plannedCapacity",
        min: 0,
        max: 5000,
        inTable: true,
      },
      IS_ACTIVE,
    ],
  },
  {
    id: "classes",
    section: "classes",
    labelKey: "schoolClasses",
    scope: "YEAR",
    labelFields: ["code"],
    fields: [
      {
        name: "levelOfferingId",
        type: "reference",
        labelKey: "levelOffering",
        referenceTo: "level-offerings",
        required: true,
        inTable: true,
      },
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "2BAC-SM-A-1",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", maxLength: 120 },
      MASSAR_CODE,
      { name: "section", type: "text", labelKey: "section", maxLength: 8, dir: "ltr", inTable: true },
      { name: "capacity", type: "number", labelKey: "capacity", min: 0, max: 200, inTable: true },
      {
        name: "mainTeacherId",
        type: "reference",
        labelKey: "mainTeacher",
        hintKey: "mainTeacher",
        referenceTo: "@teachers",
        nullable: true,
        inTable: true,
      },
      {
        name: "roomId",
        type: "reference",
        labelKey: "room",
        hintKey: "classRoom",
        referenceTo: "rooms",
        nullable: true,
        inTable: true,
      },
      IS_ACTIVE,
    ],
  },
  {
    id: "class-groups",
    section: "classes",
    labelKey: "classGroups",
    scope: "YEAR",
    labelFields: ["code"],
    fields: [
      {
        name: "schoolClassId",
        type: "reference",
        labelKey: "schoolClass",
        referenceTo: "classes",
        required: true,
        inTable: true,
      },
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 16,
        dir: "ltr",
        placeholder: "G1",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", maxLength: 120, inTable: true },
      {
        name: "purpose",
        type: "select",
        labelKey: "purpose",
        options: GROUP_PURPOSES,
        optionsKey: "groupPurposes",
        defaultValue: "OTHER",
        required: true,
        inTable: true,
      },
      {
        name: "subjectId",
        type: "reference",
        labelKey: "subject",
        hintKey: "groupSubject",
        referenceTo: "subjects",
        nullable: true,
        inTable: true,
      },
      { name: "capacity", type: "number", labelKey: "capacity", min: 0, max: 200 },
      IS_ACTIVE,
    ],
  },

  // ── Facturation ───────────────────────────────────────────────────────────
  /*
    The one singleton, and first in its section because it decides what the
    price lists under it *mean*: how many lines a monthly rate turns into, and
    what day each falls due.

    Both were constants nobody could see. `defaultInstalmentCount` sat at nine —
    right for a September–June year and wrong for any other shape, and a year
    running March to February had its fee grid cut off in November with three
    months left to bill and nothing on screen to explain it. That is the test
    for belonging here rather than in an `enums.ts`: it is a convention, not a
    fact. See prisma/schema/schools/school-settings.prisma and
    lib/school-settings.ts, which holds the defaults these fall back to.
  */
  {
    id: "school-settings",
    section: "billing",
    labelKey: "schoolSettings",
    scope: "SCHOOL",
    kind: "singleton",
    labelFields: ["id"],
    fields: [
      {
        name: "defaultInstalmentCount",
        type: "number",
        labelKey: "defaultInstalmentCount",
        hintKey: "defaultInstalmentCount",
        groupKey: "billing",
        required: true,
        // Zero is admissible and is the useful default: it means "as many as
        // the school year has months". Twelve is the ceiling because a year
        // longer than that is not a year.
        min: 0,
        max: 12,
        defaultValue: 0,
      },
      {
        name: "parentChatEnabled",
        type: "boolean",
        labelKey: "parentChatEnabled",
        hintKey: "parentChatEnabled",
        groupKey: "parents",
        defaultValue: false,
      },
      {
        name: "parentClassChatEnabled",
        type: "boolean",
        labelKey: "parentClassChatEnabled",
        hintKey: "parentClassChatEnabled",
        groupKey: "parents",
        defaultValue: false,
      },
      {
        name: "feeDueDayOfMonth",
        type: "number",
        labelKey: "feeDueDayOfMonth",
        hintKey: "feeDueDayOfMonth",
        groupKey: "billing",
        required: true,
        // 28 rather than 31 so the day exists in February — see the column.
        min: 1,
        max: 28,
        defaultValue: 5,
      },
    ],
  },
  {
    id: "fee-types",
    section: "billing",
    labelKey: "feeTypes",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "SCOLARITE",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      {
        name: "kind",
        type: "select",
        labelKey: "feeKind",
        options: FEE_KINDS,
        optionsKey: "feeKinds",
        defaultValue: "OTHER",
        required: true,
        inTable: true,
      },
      {
        name: "billingCycle",
        type: "select",
        labelKey: "billingCycle",
        hintKey: "billingCycle",
        options: BILLING_CYCLES,
        optionsKey: "billingCycles",
        defaultValue: "ANNUAL",
        required: true,
        inTable: true,
      },
      {
        name: "isMandatory",
        type: "boolean",
        labelKey: "isMandatory",
        hintKey: "isMandatory",
        defaultValue: true,
        inTable: true,
      },
      POSITION,
      IS_ACTIVE,
    ],
  },
  {
    id: "fee-rates",
    section: "billing",
    labelKey: "feeRates",
    scope: "YEAR",
    labelFields: ["amountCentimes"],
    fields: [
      {
        name: "feeTypeId",
        type: "reference",
        labelKey: "feeType",
        referenceTo: "fee-types",
        required: true,
        inTable: true,
      },
      {
        name: "levelId",
        type: "reference",
        labelKey: "level",
        hintKey: "feeRateLevel",
        referenceTo: "levels",
        nullable: true,
        inTable: true,
      },
      {
        name: "amountCentimes",
        type: "money",
        labelKey: "amount",
        hintKey: "amount",
        required: true,
        min: 0,
        inTable: true,
      },
      {
        name: "instalmentCount",
        type: "number",
        labelKey: "instalmentCount",
        hintKey: "instalmentCount",
        min: 1,
        max: 12,
        inTable: true,
      },
      {
        name: "perInstalment",
        type: "boolean",
        labelKey: "perInstalment",
        hintKey: "perInstalment",
        inTable: true,
      },
      IS_ACTIVE,
      { name: "notes", type: "textarea", labelKey: "notes", maxLength: 500, wide: true },
    ],
  },
  {
    id: "discounts",
    section: "billing",
    labelKey: "discounts",
    scope: "YEAR",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "FRATRIE-2",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      {
        name: "kind",
        type: "select",
        labelKey: "discountKind",
        hintKey: "discountKind",
        options: DISCOUNT_KINDS,
        optionsKey: "discountKinds",
        defaultValue: "PERCENTAGE",
        required: true,
        inTable: true,
      },
      {
        // Stored in basis points, entered as a percentage — a bursar setting a
        // 25% sibling reduction was previously asked to type 2500.
        name: "percentBps",
        type: "percent",
        labelKey: "percentBps",
        hintKey: "percentBps",
        min: 0,
        max: 100,
        inTable: true,
      },
      { name: "amountCentimes", type: "money", labelKey: "amount", min: 0, inTable: true },
      {
        name: "reason",
        type: "select",
        labelKey: "discountReason",
        options: DISCOUNT_REASONS,
        optionsKey: "discountReasons",
        defaultValue: "OTHER",
        required: true,
        inTable: true,
      },
      {
        name: "feeTypeId",
        type: "reference",
        labelKey: "feeType",
        hintKey: "discountFeeType",
        referenceTo: "fee-types",
        nullable: true,
        inTable: true,
      },
      { name: "isStackable", type: "boolean", labelKey: "isStackable", hintKey: "isStackable" },
      IS_ACTIVE,
      { name: "notes", type: "textarea", labelKey: "notes", maxLength: 500, wide: true },
    ],
  },

  // ── Caisse ────────────────────────────────────────────────────────────────
  /*
    The chart the caisse posts against, and the banks it deals with. All four
    used to be free-text boxes on the décaissement form, which is why no report
    could group by any of them — see prisma/schema/treasury/operation-category.
  */
  {
    id: "banks",
    section: "treasury",
    labelKey: "banks",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 16,
        dir: "ltr",
        placeholder: "AWB",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      { name: "agency", type: "text", labelKey: "agency", hintKey: "agency", maxLength: 120, inTable: true },
      {
        name: "accountNumber",
        type: "text",
        labelKey: "accountNumber",
        hintKey: "accountNumber",
        maxLength: 40,
        dir: "ltr",
      },
      POSITION,
      IS_ACTIVE,
    ],
  },
  {
    id: "operation-categories",
    section: "treasury",
    labelKey: "operationCategories",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "FOURNITURES",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      {
        name: "kind",
        type: "select",
        labelKey: "categoryKind",
        hintKey: "categoryKind",
        options: CATEGORY_KINDS,
        optionsKey: "categoryKinds",
        defaultValue: "OUT",
        required: true,
        inTable: true,
      },
      POSITION,
      IS_ACTIVE,
    ],
  },
  {
    id: "operation-subcategories",
    section: "treasury",
    labelKey: "operationSubcategories",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "categoryId",
        type: "reference",
        labelKey: "operationCategory",
        hintKey: "subcategoryParent",
        referenceTo: "operation-categories",
        required: true,
        inTable: true,
      },
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "PAPETERIE",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      POSITION,
      IS_ACTIVE,
    ],
  },
  {
    id: "operation-motifs",
    section: "treasury",
    labelKey: "operationMotifs",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "ACHAT-FOURNITURES",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 160, inTable: true },
      NAME_AR,
      {
        // Optional on purpose: a motif with no rubrique is offered under every
        // one of them. See OperationMotif.categoryId.
        name: "categoryId",
        type: "reference",
        labelKey: "operationCategory",
        hintKey: "motifCategory",
        referenceTo: "operation-categories",
        nullable: true,
        inTable: true,
      },
      POSITION,
      IS_ACTIVE,
    ],
  },
  // ── Logistique ────────────────────────────────────────────────────────────
  /*
    Horaires de transport. Declared once per year and shared by every circuit
    that runs them, rather than retyped on each stop — which is what
    RouteStop.pickupTime was doing before. Which circuit makes which run is the
    circuit's own screen, under /transport/routes.
  */
  {
    id: "transport-schedules",
    section: "logistique",
    labelKey: "transportSchedules",
    scope: "YEAR",
    labelFields: ["code", "name"],
    fields: [
      { name: "code", type: "text", labelKey: "code", required: true, maxLength: 20, dir: "ltr", placeholder: "M1", inTable: true },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 120, inTable: true },
      NAME_AR,
      {
        name: "direction",
        type: "select",
        labelKey: "scheduleDirection",
        hintKey: "scheduleDirection",
        options: SCHEDULE_DIRECTIONS,
        optionsKey: "scheduleDirections",
        defaultValue: "MORNING",
        required: true,
        inTable: true,
      },
      { name: "departureTime", type: "time", labelKey: "departureTime", required: true, dir: "ltr", inTable: true },
      { name: "arrivalTime", type: "time", labelKey: "arrivalTime", hintKey: "arrivalTime", dir: "ltr", inTable: true },
      POSITION,
      IS_ACTIVE,
    ],
  },
  /*
    Le catalogue de fournitures. Declared once by the school; a liste de
    fournitures is then assembled by *picking* from it rather than typed, which
    is what stops the same pen arriving as "stylo bleu", "Stylo à bille bleu"
    and "bic bleu" on three lists of the same class. See
    prisma/schema/supplies/supply-article.prisma.
  */
  {
    id: "supply-articles",
    section: "logistique",
    labelKey: "supplyArticles",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 40,
        dir: "ltr",
        placeholder: "STYLO-BLEU",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 160, inTable: true },
      NAME_AR,
      {
        name: "category",
        type: "select",
        labelKey: "supplyCategory",
        hintKey: "supplyCategory",
        options: SUPPLY_CATEGORIES,
        optionsKey: "supplyCategories",
        defaultValue: "ECRITURE",
        required: true,
        inTable: true,
      },
      {
        name: "defaultQuantity",
        type: "number",
        labelKey: "defaultQuantity",
        hintKey: "defaultQuantity",
        min: 1,
        max: 100,
        nullable: true,
        inTable: true,
      },
      {
        name: "notes",
        type: "textarea",
        labelKey: "supplyArticleNotes",
        hintKey: "supplyArticleNotes",
        maxLength: 200,
        wide: true,
      },
      POSITION,
      IS_ACTIVE,
    ],
  },
  /*
    Les fournisseurs. Declared once so the factures and achats screens are a
    single select rather than three free-text boxes — the rubrique each one
    posts under travels with it. See prisma/schema/treasury/supplier.prisma.
  */
  {
    id: "suppliers",
    section: "treasury",
    labelKey: "suppliers",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 32,
        dir: "ltr",
        placeholder: "LYDEC",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 160, inTable: true },
      NAME_AR,
      {
        name: "kind",
        type: "select",
        labelKey: "supplierKind",
        hintKey: "supplierKind",
        options: SUPPLIER_KINDS,
        optionsKey: "supplierKinds",
        defaultValue: "VENDOR",
        required: true,
        inTable: true,
      },
      {
        name: "defaultCategoryId",
        type: "reference",
        labelKey: "defaultCategory",
        hintKey: "defaultCategory",
        referenceTo: "operation-categories",
        nullable: true,
        inTable: true,
      },
      {
        name: "accountRef",
        type: "text",
        labelKey: "accountRef",
        hintKey: "accountRef",
        maxLength: 60,
        dir: "ltr",
      },
      { name: "phone", type: "text", labelKey: "phone", maxLength: 40, dir: "ltr" },
      POSITION,
      IS_ACTIVE,
    ],
  },
  /*
    Les pièces du dossier d'inscription. Declared once by the school; every
    pupil's dossier is then read against this list, so adding a pièce here shows
    up on every dossier and withdrawing one stops it being asked for — without
    touching a single pupil. See prisma/schema/documents/document-type.prisma.
  */
  {
    id: "document-types",
    section: "school",
    labelKey: "documentTypes",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 40,
        dir: "ltr",
        placeholder: "ACTE-NAISSANCE",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 160, inTable: true },
      NAME_AR,
      {
        name: "isRequired",
        type: "boolean",
        labelKey: "isRequiredDocument",
        hintKey: "isRequiredDocument",
        defaultValue: true,
        inTable: true,
      },
      {
        name: "copies",
        type: "number",
        labelKey: "copies",
        hintKey: "copies",
        min: 1,
        max: 10,
        nullable: true,
        inTable: true,
      },
      {
        name: "notes",
        type: "textarea",
        labelKey: "documentNotes",
        hintKey: "documentNotes",
        maxLength: 300,
        wide: true,
      },
      POSITION,
      IS_ACTIVE,
    ],
  },

  {
    // What the school issues *for* families — the mirror of the dossier above,
    // and deliberately a separate list: no row belongs on both. See
    // prisma/schema/requests/document-request-type.prisma.
    id: "request-types",
    section: "school",
    labelKey: "requestTypes",
    scope: "SCHOOL",
    labelFields: ["code", "name"],
    fields: [
      {
        name: "code",
        type: "text",
        labelKey: "code",
        required: true,
        maxLength: 40,
        dir: "ltr",
        placeholder: "ATTEST-SCO",
        inTable: true,
      },
      { name: "name", type: "text", labelKey: "name", required: true, maxLength: 160, inTable: true },
      NAME_AR,
      {
        name: "description",
        type: "textarea",
        labelKey: "requestDescription",
        hintKey: "requestDescription",
        maxLength: 300,
        wide: true,
      },
      {
        name: "descriptionAr",
        type: "textarea",
        labelKey: "requestDescriptionAr",
        maxLength: 300,
        dir: "ltr",
        wide: true,
      },
      {
        name: "usualDelayDays",
        type: "number",
        labelKey: "usualDelayDays",
        hintKey: "usualDelayDays",
        min: 0,
        max: 90,
        nullable: true,
        inTable: true,
      },
      {
        name: "requiresReason",
        type: "boolean",
        labelKey: "requiresReason",
        hintKey: "requiresReason",
        defaultValue: false,
        inTable: true,
      },
      POSITION,
      IS_ACTIVE,
    ],
  },
];

export function findResource(id: string): ResourceDef | undefined {
  return RESOURCES.find((resource) => resource.id === id);
}

export function resourcesInSection(sectionId: string): ResourceDef[] {
  return RESOURCES.filter((resource) => resource.section === sectionId);
}

export function findSection(id: string): SectionDef | undefined {
  return SECTIONS.find((section) => section.id === id);
}

/** The scope group a section is clustered under — see `SCOPE_GROUPS`. */
export function groupOfSection(sectionId: string): ScopeGroupDef {
  return (
    SCOPE_GROUPS.find((group) => group.sectionIds.includes(sectionId)) ??
    SCOPE_GROUPS[0]
  );
}

export function sectionsInGroup(groupId: string): SectionDef[] {
  const group = SCOPE_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) return [];
  return group.sectionIds
    .map((sectionId) => findSection(sectionId))
    .filter((section): section is SectionDef => Boolean(section));
}
