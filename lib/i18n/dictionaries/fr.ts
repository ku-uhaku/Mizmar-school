import type { Dictionary } from "@/lib/i18n/types";

import core, { nav as coreNav } from "@/lib/i18n/core/fr";
import access, {
  nav as accessNav,
  permissions as accessPermissions,
} from "@/modules/access/i18n/fr";
import appearance, { nav as appearanceNav } from "@/modules/appearance/i18n/fr";
import auth from "@/modules/auth/i18n/fr";
import configuration, {
  nav as configurationNav,
  permissions as configurationPermissions,
} from "@/modules/configuration/i18n/fr";
import context from "@/modules/context/i18n/fr";
import dashboard, { nav as dashboardNav } from "@/modules/dashboard/i18n/fr";
import organization, {
  nav as organizationNav,
  permissions as organizationPermissions,
} from "@/modules/organization/i18n/fr";
import profile, { nav as profileNav } from "@/modules/profile/i18n/fr";
import schoolYears, {
  nav as schoolYearsNav,
  permissions as schoolYearsPermissions,
} from "@/modules/school-years/i18n/fr";
import schools, {
  nav as schoolsNav,
  permissions as schoolsPermissions,
} from "@/modules/schools/i18n/fr";
import users, {
  nav as usersNav,
  permissions as usersPermissions,
} from "@/modules/users/i18n/fr";
import classes, {
  nav as classesNav,
  permissions as classesPermissions,
} from "@/modules/classes/i18n/fr";
import enrolment, {
  permissions as enrolmentPermissions,
} from "@/modules/enrolment/i18n/fr";
import families, {
  nav as familiesNav,
  permissions as familiesPermissions,
} from "@/modules/families/i18n/fr";
import schoolLife, {
  nav as schoolLifeNav,
  permissions as schoolLifePermissions,
} from "@/modules/school-life/i18n/fr";
import students, {
  nav as studentsNav,
  permissions as studentsPermissions,
} from "@/modules/students/i18n/fr";
import timetable, {
  nav as timetableNav,
  permissions as timetablePermissions,
} from "@/modules/timetable/i18n/fr";

/**
 * French. Assembled exactly like `en.ts` — see that file for the registration
 * steps. The `Dictionary` annotation is what reports a missing or misspelt key.
 */
const fr: Dictionary = {
  ...core,

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
};

export default fr;
