import type { Prisma } from "@/lib/generated/prisma/client";

import {
  ACCESS_ENTITY,
  SESSION_ENTITY,
  type ActivityDomain,
} from "@/modules/audit/enums";

/**
 * What the capture layer knows about the app's tables.
 *
 * Pure data, deliberately: `lib/audit.ts` sits *inside* the Prisma client and
 * `modules/audit/components/*` run in the browser, so both ends of the feature
 * read this file and neither may drag the database into the other. The only
 * import is a type, which compiles away.
 *
 * Nothing here is per-module configuration a module has to remember to add. A
 * new table is captured whether or not it is mentioned below; being mentioned
 * only changes which filter it sits under and how its rows are labelled.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Which tables are watched
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tables whose writes are never logged.
 *
 * `ActivityLog` for the obvious reason — logging the log recurses. The rest are
 * bookkeeping the app writes on its own account, not acts a person performed:
 * `LoginAttempt` is the brute-force counter, and it ticks on every keystroke of
 * a mistyped password while the login events themselves are recorded by hand
 * with far more to say.
 */
export const UNAUDITED_MODELS: readonly string[] = [
  "ActivityLog",
  "LoginAttempt",
];

/**
 * Never written into `changes`, whatever table they appear on.
 *
 * The trail is read by administrators, exported and kept for years; a password
 * hash in it is a password hash in every backup of it. Matched case-insensitively
 * against the field name, so a future `resetToken` or `apiSecret` is caught the
 * day it is added rather than the day somebody notices.
 */
export const REDACTED_FIELD_PATTERNS: readonly RegExp[] = [
  /password/i,
  /secret/i,
  /token/i,
  /hash$/i,
];

export function isRedacted(field: string): boolean {
  return REDACTED_FIELD_PATTERNS.some((pattern) => pattern.test(field));
}

/**
 * Fields excluded from a diff because they change on their own and say nothing:
 * the row's own clock, the id that is already on the entry, and the stamp the
 * sign-in writes — which the LOGIN event records far better than a `User`
 * update reading "one field changed" ever could.
 */
export const IGNORED_FIELDS: readonly string[] = [
  "id",
  "createdAt",
  "updatedAt",
  "lastLoginAt",
];

// ─────────────────────────────────────────────────────────────────────────────
//  Where a table sits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every model, grouped into the area of the app it belongs to.
 *
 * Exhaustive over `Prisma.ModelName` on purpose: adding a table is a compile
 * error here until somebody says where its history should be filed. That is the
 * one line of upkeep this feature asks of a new module, and it is checked rather
 * than remembered.
 */
export const MODEL_DOMAINS: Record<Prisma.ModelName, ActivityDomain> = {
  // Who may do what.
  User: "access",
  Profile: "access",
  Role: "access",
  Permission: "access",
  RolePermission: "access",
  Membership: "access",
  LoginAttempt: "access",
  ActivityLog: "access",

  // The institution and its calendar.
  Organization: "organization",
  School: "organization",
  SchoolSettings: "organization",
  SchoolYear: "organization",
  Term: "organization",
  SchoolWeek: "organization",
  SchoolHoliday: "organization",

  // The children and their year.
  Family: "vieScolaire",
  Guardian: "vieScolaire",
  Student: "vieScolaire",
  Enrollment: "vieScolaire",
  EnrollmentFee: "vieScolaire",
  EnrollmentOption: "vieScolaire",
  LevelOffering: "vieScolaire",
  SchoolClass: "vieScolaire",
  ClassGroup: "vieScolaire",
  TeachingAssignment: "vieScolaire",
  StudentAttendance: "vieScolaire",
  StudentRemark: "vieScolaire",
  Assessment: "vieScolaire",
  AssessmentGrade: "vieScolaire",
  AssessmentQuestion: "vieScolaire",
  Bulletin: "vieScolaire",
  BulletinLine: "vieScolaire",
  SupplyList: "vieScolaire",
  SupplyItem: "vieScolaire",
  StudentDocument: "vieScolaire",
  DocumentRequest: "vieScolaire",
  ReportFavourite: "vieScolaire",

  // The week.
  TimeSlot: "timetable",
  TimetableEntry: "timetable",
  TimetableException: "timetable",
  TeacherAbsence: "timetable",
  TeacherUnavailability: "timetable",

  // The money.
  Payment: "finance",
  PaymentAllocation: "finance",
  PaymentTender: "finance",
  CashRegister: "finance",
  CashSession: "finance",
  CashOperation: "finance",
  Cheque: "finance",
  Bank: "finance",
  Supplier: "finance",
  OperationCategory: "finance",
  OperationSubcategory: "finance",
  OperationMotif: "finance",

  // The staff.
  Staff: "rh",
  EmploymentContract: "rh",
  StaffAttendance: "rh",
  LeaveRequest: "rh",
  SalaryPayment: "rh",
  SalaryAdvance: "rh",
  SalaryAdvanceRecovery: "rh",
  TeacherSubject: "rh",
  TeacherSubjectLevel: "rh",

  // The fleet.
  Vehicle: "transport",
  FuelRequest: "transport",
  TransportRoute: "transport",
  TransportSchedule: "transport",
  TransportSubscription: "transport",
  TransportAttendance: "transport",
  RouteStop: "transport",
  RouteSchedule: "transport",
  RouteNeighbourhood: "transport",
  TripRun: "transport",

  // The reference data behind all of it.
  EducationLevel: "configuration",
  Level: "configuration",
  Track: "configuration",
  Subject: "configuration",
  LevelSubject: "configuration",
  AssessmentType: "configuration",
  DocumentRequestType: "configuration",
  AppreciationBand: "configuration",
  DocumentType: "configuration",
  FeeType: "configuration",
  FeeRate: "configuration",
  Discount: "configuration",
  Room: "configuration",
  City: "configuration",
  Neighbourhood: "configuration",
  SupplyArticle: "configuration",
  Event: "vieScolaire",
  ChatChannel: "vieScolaire",
  ChatMessage: "vieScolaire",
  // A read watermark is the account's own bookkeeping, not the school's. So is
  // an inbox: a notification is addressed to one account and belongs to its
  // history rather than to the domain of whatever happening produced it.
  PortalSeen: "access",
  Notification: "access",
  EventAudience: "vieScolaire",
};

/** The domain an entry belongs to, including the two pseudo-entities. */
export function domainOf(entity: string): ActivityDomain {
  if (entity === SESSION_ENTITY || entity === ACCESS_ENTITY) return "security";
  return MODEL_DOMAINS[entity as Prisma.ModelName] ?? "configuration";
}

/** Every model filed under one domain, for the entity filter. */
export function modelsInDomain(domain: ActivityDomain): string[] {
  if (domain === "security") return [SESSION_ENTITY, ACCESS_ENTITY];
  return Object.entries(MODEL_DOMAINS)
    .filter(([, value]) => value === domain)
    .map(([model]) => model)
    .filter((model) => !UNAUDITED_MODELS.includes(model))
    .sort();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Naming a row
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fields tried, in order, to give a row a human name.
 *
 * One list rather than eighty label functions: the tables already agree on what
 * a row is called — a pupil has a `firstName`, a class a `code`, a cheque a
 * `number` — and a rule that follows the schema's own conventions keeps working
 * for tables nobody has thought about yet.
 */
const LABEL_FIELDS: readonly string[] = [
  "name",
  "title",
  "label",
  "code",
  "reference",
  "number",
  "email",
];

type Row = Record<string, unknown>;

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * How the row read at the time of the write — "Yasmine Alaoui", "3AP-A",
 * "REC-2025-0142". Null when the row carries nothing a person would recognise
 * it by, in which case the screen falls back to the id.
 */
export function labelOf(row: Row | null | undefined): string | null {
  if (!row) return null;

  // A person is named by both halves, and a table that has them means them.
  const first = text(row.firstName);
  const last = text(row.lastName);
  if (first || last) return [first, last].filter(Boolean).join(" ");

  for (const field of LABEL_FIELDS) {
    const value = text(row[field]);
    if (value) return value;
  }

  return null;
}

/**
 * The tenant and school an affected row belongs to, read off the row itself
 * when it carries them.
 *
 * Preferred over the actor's current context: an administrator with org-wide
 * reach editing a row in school B while school A is selected in their header
 * must file the entry under B, or the trail answers the wrong question.
 */
export function scopeOf(row: Row | null | undefined): {
  organizationId?: string;
  schoolId?: string;
  schoolYearId?: string;
} {
  if (!row) return {};
  const pick = (field: string) =>
    typeof row[field] === "string" ? (row[field] as string) : undefined;

  return {
    organizationId: pick("organizationId"),
    schoolId: pick("schoolId"),
    schoolYearId: pick("schoolYearId"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Reaching the row from the trail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where to send a reader who wants to see the row an entry is about.
 *
 * Only the entities that *have* a screen of their own: an `EnrollmentFee` is
 * read inside a pupil's file and has no address, so its entry links nowhere
 * rather than to a broken page.
 */
const ENTITY_ROUTES: Partial<Record<Prisma.ModelName, (id: string) => string>> =
  {
    Student: (id) => `/students/${id}`,
    Family: (id) => `/families/${id}`,
    User: (id) => `/users/${id}`,
    Role: (id) => `/roles/${id}`,
    School: (id) => `/schools/${id}`,
    SchoolClass: (id) => `/classes/${id}`,
    Staff: (id) => `/hr/staff/${id}`,
    Assessment: (id) => `/assessments/${id}`,
    TransportRoute: (id) => `/transport/routes/${id}`,
    CashSession: (id) => `/caisse/registers/sessions/${id}`,
  };

export function hrefFor(entity: string, entityId: string | null): string | null {
  if (!entityId) return null;
  return ENTITY_ROUTES[entity as Prisma.ModelName]?.(entityId) ?? null;
}
