import core, { nav as coreNav } from "@/lib/i18n/core/en";
import access, {
  nav as accessNav,
  permissions as accessPermissions,
} from "@/modules/access/i18n/en";
import appearance, { nav as appearanceNav } from "@/modules/appearance/i18n/en";
import auth from "@/modules/auth/i18n/en";
import configuration, {
  nav as configurationNav,
  permissions as configurationPermissions,
} from "@/modules/configuration/i18n/en";
import context from "@/modules/context/i18n/en";
import dashboard, { nav as dashboardNav } from "@/modules/dashboard/i18n/en";
import organization, {
  nav as organizationNav,
  permissions as organizationPermissions,
} from "@/modules/organization/i18n/en";
import profile, { nav as profileNav } from "@/modules/profile/i18n/en";
import schoolYears, {
  nav as schoolYearsNav,
  permissions as schoolYearsPermissions,
} from "@/modules/school-years/i18n/en";
import schools, {
  nav as schoolsNav,
  permissions as schoolsPermissions,
} from "@/modules/schools/i18n/en";
import users, {
  nav as usersNav,
  permissions as usersPermissions,
} from "@/modules/users/i18n/en";
import classes, {
  nav as classesNav,
  permissions as classesPermissions,
} from "@/modules/classes/i18n/en";
import enrolment, {
  permissions as enrolmentPermissions,
} from "@/modules/enrolment/i18n/en";
import families, {
  nav as familiesNav,
  permissions as familiesPermissions,
} from "@/modules/families/i18n/en";
import schoolLife, {
  nav as schoolLifeNav,
  permissions as schoolLifePermissions,
} from "@/modules/school-life/i18n/en";
import students, {
  nav as studentsNav,
  permissions as studentsPermissions,
} from "@/modules/students/i18n/en";
import timetable, {
  nav as timetableNav,
  permissions as timetablePermissions,
} from "@/modules/timetable/i18n/en";

/**
 * The canonical dictionary, assembled from the core strings plus every module's
 * own translations. `Dictionary` (lib/i18n/types.ts) is derived from this
 * object, so `fr` and `ar` are checked against exactly this shape — a key added
 * to any module's `i18n/en.ts` is a compile error until the other two supply it.
 *
 * ── Registering a module ──────────────────────────────────────────────────────
 * Add the module's import above and its spread below, then do the same in
 * `fr.ts` and `ar.ts`. Two namespaces are *merged* rather than spread, because
 * several modules contribute to each:
 *
 *   nav          — the sidebar labels; sections come from core
 *   permissions  — the permission matrix labels
 *
 * Everything else is a plain namespace owned by exactly one module, so a name
 * clash between two modules is a type error here rather than a silent override.
 */
const en = {
  ...core,

  // One namespace per module.
  ...auth,
  ...context,
  ...dashboard,
  ...organization,
  ...schools,
  ...schoolYears,
  ...users,
  ...access,
  ...configuration,
  ...profile,
  ...appearance,

  // Vie scolaire.
  ...schoolLife,
  ...families,
  ...students,
  ...enrolment,
  ...classes,
  ...timetable,

  // Merged namespaces — contributed to by many modules.
  nav: {
    ...coreNav,
    ...dashboardNav,
    ...organizationNav,
    ...schoolsNav,
    ...schoolYearsNav,
    ...usersNav,
    ...accessNav,
    ...configurationNav,
    ...profileNav,
    ...appearanceNav,
    ...schoolLifeNav,
    ...familiesNav,
    ...studentsNav,
    ...classesNav,
    ...timetableNav,
  },
  permissions: {
    groups: {
      ...organizationPermissions.groups,
      ...schoolsPermissions.groups,
      ...schoolYearsPermissions.groups,
      ...usersPermissions.groups,
      ...accessPermissions.groups,
      ...configurationPermissions.groups,
      ...schoolLifePermissions.groups,
      ...familiesPermissions.groups,
      ...studentsPermissions.groups,
      ...enrolmentPermissions.groups,
      ...classesPermissions.groups,
      ...timetablePermissions.groups,
    },
    codes: {
      ...organizationPermissions.codes,
      ...schoolsPermissions.codes,
      ...schoolYearsPermissions.codes,
      ...usersPermissions.codes,
      ...accessPermissions.codes,
      ...configurationPermissions.codes,
      ...schoolLifePermissions.codes,
      ...familiesPermissions.codes,
      ...studentsPermissions.codes,
      ...enrolmentPermissions.codes,
      ...classesPermissions.codes,
      ...timetablePermissions.codes,
    },
  },
} as const;

export default en;
