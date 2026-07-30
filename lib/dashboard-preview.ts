/**
 * PLACEHOLDER DATA — not read from the database.
 *
 * The dashboard's analytics half previews what the app will show once the
 * academic tables (students, enrolments, attendance, invoicing) exist. Until
 * then these fixed numbers stand in, so the layout, the charts and the empty
 * states can be built and reviewed now instead of after the schema lands.
 *
 * Every widget fed from here is rendered behind a "demo" badge — see
 * `PreviewCard` in the dashboard page. Nothing in this file is ever persisted,
 * and no permission check depends on it.
 *
 * The values are hard-coded rather than randomised on purpose: random numbers
 * differ between the server render and the client hydration, which React treats
 * as a mismatch, and they would also make the UI shift on every refresh.
 *
 * To wire a widget up for real: delete its entry here and pass real rows in
 * from the page's own query. The chart components take plain arrays and know
 * nothing about this module.
 */

/** Students enrolled at each month-end across the academic year. */
export const ENROLMENT_BY_MONTH = [
  1180, 1204, 1222, 1231, 1240, 1238, 1252, 1266, 1279, 1288, 1294, 1302,
];

/** Headcount per school level, in the order SCHOOL_LEVELS declares them. */
export const STUDENTS_BY_LEVEL: Record<string, number> = {
  PRESCHOOL: 186,
  PRIMARY: 512,
  MIDDLE: 371,
  HIGH: 233,
};

/** Share of the student body per school, by position in the school list. */
export const STUDENTS_BY_SCHOOL = [548, 421, 333];

/** Headline figures for the KPI row. */
export const PREVIEW_KPIS = {
  students: { value: 1302, delta: 4.1, trend: ENROLMENT_BY_MONTH },
  teachers: { value: 96, delta: 2.1, trend: [88, 89, 91, 90, 92, 94, 94, 96] },
  attendance: { value: 94, delta: -0.8, trend: [96, 95, 96, 94, 95, 93, 94, 94] },
  /** Share of this term's fees collected. */
  feesCollected: { value: 87, delta: 6.4, trend: [62, 68, 71, 75, 79, 82, 85, 87] },
};

/** Occupancy of the current cohort against declared capacity. */
export const CAPACITY = { enrolled: 1302, capacity: 1560 };

/** Recent activity feed. `key` resolves to a dictionary string. */
export const RECENT_ACTIVITY = [
  { key: "enrolment", actor: "Nadia Benali", minutesAgo: 12 },
  { key: "payment", actor: "Imane Ouazzani", minutesAgo: 48 },
  { key: "grades", actor: "Karim Bennis", minutesAgo: 155 },
  { key: "absence", actor: "Imane Ouazzani", minutesAgo: 320 },
  { key: "staff", actor: "Amine Tazi", minutesAgo: 1460 },
] as const;

export type ActivityKey = (typeof RECENT_ACTIVITY)[number]["key"];

/** Upcoming deadlines. `inDays` is relative so the list never goes stale. */
export const UPCOMING = [
  { key: "councils", inDays: 3 },
  { key: "reportCards", inDays: 9 },
  { key: "feesDue", inDays: 14 },
  { key: "termEnd", inDays: 28 },
] as const;

export type UpcomingKey = (typeof UPCOMING)[number]["key"];
