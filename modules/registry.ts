import type { AppModule } from "@/lib/module";

import { academicsModule } from "@/modules/academics/module";
import { assessmentsModule } from "@/modules/assessments/module";
import { ASSESSMENT_PERMISSIONS } from "@/modules/assessments/permissions";
import { accessModule } from "@/modules/access/module";
import { ROLE_PERMISSIONS } from "@/modules/access/permissions";
import { appearanceModule } from "@/modules/appearance/module";
import { authModule } from "@/modules/auth/module";
import { billingModule } from "@/modules/billing/module";
import { classesModule } from "@/modules/classes/module";
import { classroomModule } from "@/modules/classroom/module";
import { CLASSROOM_PERMISSIONS } from "@/modules/classroom/permissions";
import { CLASS_PERMISSIONS } from "@/modules/classes/permissions";
import { configurationModule } from "@/modules/configuration/module";
import { CONFIGURATION_PERMISSIONS } from "@/modules/configuration/permissions";
import { contextModule } from "@/modules/context/module";
import { dashboardModule } from "@/modules/dashboard/module";
import { enrolmentModule } from "@/modules/enrolment/module";
import { ENROLMENT_PERMISSIONS } from "@/modules/enrolment/permissions";
import { facilitiesModule } from "@/modules/facilities/module";
import { geographyModule } from "@/modules/geography/module";
import { hrModule } from "@/modules/hr/module";
import { importsModule } from "@/modules/imports/module";
import { IMPORT_PERMISSIONS } from "@/modules/imports/permissions";
import { HR_PERMISSIONS } from "@/modules/hr/permissions";
import { familiesModule } from "@/modules/families/module";
import { FAMILY_PERMISSIONS } from "@/modules/families/permissions";
import { organizationModule } from "@/modules/organization/module";
import { ORGANIZATION_PERMISSIONS } from "@/modules/organization/permissions";
import { profileModule } from "@/modules/profile/module";
import { schoolLifeModule } from "@/modules/school-life/module";
import { SCHOOL_LIFE_PERMISSIONS } from "@/modules/school-life/permissions";
import { schoolYearsModule } from "@/modules/school-years/module";
import { SCHOOL_YEAR_PERMISSIONS } from "@/modules/school-years/permissions";
import { schoolsModule } from "@/modules/schools/module";
import { SCHOOL_PERMISSIONS } from "@/modules/schools/permissions";
import { studentsModule } from "@/modules/students/module";
import { suppliesModule } from "@/modules/supplies/module";
import { SUPPLY_PERMISSIONS } from "@/modules/supplies/permissions";
import { documentsModule } from "@/modules/documents/module";
import { reportsModule } from "@/modules/reports/module";
import { REPORT_PERMISSIONS } from "@/modules/reports/permissions";
import { DOCUMENT_PERMISSIONS } from "@/modules/documents/permissions";
import { STUDENT_PERMISSIONS } from "@/modules/students/permissions";
import { timetableModule } from "@/modules/timetable/module";
import { TIMETABLE_PERMISSIONS } from "@/modules/timetable/permissions";
import { treasuryModule } from "@/modules/treasury/module";
import { TREASURY_PERMISSIONS } from "@/modules/treasury/permissions";
import { transportModule } from "@/modules/transport/module";
import { TRANSPORT_PERMISSIONS } from "@/modules/transport/permissions";
import { usersModule } from "@/modules/users/module";
import { USER_PERMISSIONS } from "@/modules/users/permissions";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE MODULE REGISTRY — the one file you edit when adding a module.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Everything the app knows about its own shape is derived from here:
 *
 *   lib/permissions.ts  → the permission catalogue, matrix layout and seed
 *   lib/nav.ts          → the sidebar
 *
 * Adding a module means: create `modules/<id>/`, then add its manifest to
 * `MODULES` and its permission object to `PERMISSIONS` below. Nothing else in
 * the app has a list that needs keeping in step — except the three dictionary
 * files, which import the module's translations (see lib/i18n/dictionaries/en.ts).
 *
 * Client-safe by construction: manifests and permission codes are plain data,
 * so this file may be imported from client components. Never import a module's
 * `queries.ts`, `service.ts` or `actions.ts` here — those are server-only and
 * would drag the database client into the browser bundle.
 */

/**
 * Registration order. It does not affect the sidebar (that sorts by `section`
 * and `order`), but it *is* the order the permission matrix lays its groups out
 * in — so keep it roughly "broadest domain first".
 */
export const MODULES: readonly AppModule[] = [
  dashboardModule,
  organizationModule,
  schoolsModule,
  schoolYearsModule,
  usersModule,
  accessModule,
  configurationModule,
  hrModule,
  profileModule,
  appearanceModule,

  // ── Vie scolaire ──────────────────────────────────────────────────────────
  // The running of a year: the families, the children, their inscriptions and
  // the fee schedules those generate, the classes they sit in and the weeks
  // they follow. `school-life` owns no tables — it is the overview and the
  // header search — and `enrolment` contributes no nav, since an inscription is
  // always reached through the pupil or the class it belongs to.
  schoolLifeModule,
  familiesModule,
  studentsModule,
  enrolmentModule,
  classesModule,
  assessmentsModule,
  classroomModule,
  timetableModule,
  suppliesModule,
  documentsModule,
  importsModule,
  reportsModule,

  // ── Caisse ────────────────────────────────────────────────────────────────
  // The money side of the year: the tills, the receipts that settle the fee
  // schedules `enrolment` raises, and everything paid out. Billing declares what
  // is owed; this decides what has actually been paid.
  treasuryModule,

  // ── Logistique ────────────────────────────────────────────────────────────
  // The fleet, the lines it runs and who rides on them. It owns no charge of
  // its own: the bus is one flat fee on the price list, raised on the
  // échéancier at enrolment like every other charge.
  transportModule,

  // Academic configuration. Tables and enums only — edited through the generic
  // configuration screens, so they contribute no nav entry and no permissions.
  academicsModule,
  facilitiesModule,
  geographyModule,
  billingModule,

  // No nav, no tables — registered so the registry is a complete inventory.
  authModule,
  contextModule,
];

/**
 * Every permission code in the app, keyed by a SCREAMING_CASE name.
 *
 * Spread rather than derived from `MODULES` on purpose: spreading the `as const`
 * objects keeps the string-literal types, which is what makes
 * `PERMISSIONS.SCHOOL_CREATE` autocomplete and what makes `PermissionCode` a
 * closed union instead of `string`. A key collision between two modules is a
 * silent override, so keep names prefixed with the module's domain.
 */
export const PERMISSIONS = {
  ...ORGANIZATION_PERMISSIONS,
  ...SCHOOL_PERMISSIONS,
  ...SCHOOL_YEAR_PERMISSIONS,
  ...USER_PERMISSIONS,
  ...ROLE_PERMISSIONS,
  ...CONFIGURATION_PERMISSIONS,
  ...HR_PERMISSIONS,
  ...SCHOOL_LIFE_PERMISSIONS,
  ...FAMILY_PERMISSIONS,
  ...STUDENT_PERMISSIONS,
  ...ENROLMENT_PERMISSIONS,
  ...CLASS_PERMISSIONS,
  ...ASSESSMENT_PERMISSIONS,
  ...CLASSROOM_PERMISSIONS,
  ...TIMETABLE_PERMISSIONS,
  ...SUPPLY_PERMISSIONS,
  ...DOCUMENT_PERMISSIONS,
  ...IMPORT_PERMISSIONS,
  ...REPORT_PERMISSIONS,
  ...TREASURY_PERMISSIONS,
  ...TRANSPORT_PERMISSIONS,
} as const;
