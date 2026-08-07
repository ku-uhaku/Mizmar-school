import type { Dictionary } from "@/lib/i18n/types";

import core, { nav as coreNav } from "@/lib/i18n/core/fr";
import access, {
  nav as accessNav,
  permissions as accessPermissions,
} from "@/modules/access/i18n/fr";
import appearance, { nav as appearanceNav } from "@/modules/appearance/i18n/fr";
import audit, {
  nav as auditNav,
  permissions as auditPermissions,
} from "@/modules/audit/i18n/fr";
import auth from "@/modules/auth/i18n/fr";
import configuration, {
  nav as configurationNav,
  permissions as configurationPermissions,
} from "@/modules/configuration/i18n/fr";
import context from "@/modules/context/i18n/fr";
import hr, {
  nav as hrNav,
  permissions as hrPermissions,
} from "@/modules/hr/i18n/fr";
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
import assessments, {
  nav as assessmentsNav,
  permissions as assessmentsPermissions,
} from "@/modules/assessments/i18n/fr";
import classroom, {
  nav as classroomNav,
  permissions as classroomPermissions,
} from "@/modules/classroom/i18n/fr";
import enrolment, {
  permissions as enrolmentPermissions,
} from "@/modules/enrolment/i18n/fr";
import families, {
  nav as familiesNav,
  permissions as familiesPermissions,
} from "@/modules/families/i18n/fr";
import events, {
  nav as eventsNav,
  permissions as eventsPermissions,
} from "@/modules/events/i18n/fr";
import schoolLife, {
  nav as schoolLifeNav,
  permissions as schoolLifePermissions,
} from "@/modules/school-life/i18n/fr";
import supplies, {
  nav as suppliesNav,
  permissions as suppliesPermissions,
} from "@/modules/supplies/i18n/fr";
import documents, {
  permissions as documentsPermissions,
} from "@/modules/documents/i18n/fr";
import imports, {
  permissions as importsPermissions,
} from "@/modules/imports/i18n/fr";
import reports, {
  nav as reportsNav,
  permissions as reportsPermissions,
} from "@/modules/reports/i18n/fr";
import students, {
  nav as studentsNav,
  permissions as studentsPermissions,
} from "@/modules/students/i18n/fr";
import timetable, {
  nav as timetableNav,
  permissions as timetablePermissions,
} from "@/modules/timetable/i18n/fr";
import treasury, {
  nav as treasuryNav,
  permissions as treasuryPermissions,
} from "@/modules/treasury/i18n/fr";
import transport, {
  nav as transportNav,
  permissions as transportPermissions,
} from "@/modules/transport/i18n/fr";

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
  ...hr,
  ...profile,
  ...appearance,
  ...audit,

  // Vie scolaire.
  ...schoolLife,
  ...events,
  ...families,
  ...students,
  ...supplies,
  ...documents,
  ...imports,
  ...reports,
  ...enrolment,
  ...classes,
  ...assessments,
  ...classroom,
  ...timetable,

  // Caisse.
  ...treasury,

  // Logistique.
  ...transport,

  nav: {
    ...coreNav,
    ...dashboardNav,
    ...organizationNav,
    ...schoolsNav,
    ...schoolYearsNav,
    ...usersNav,
    ...accessNav,
    ...configurationNav,
    ...hrNav,
    ...profileNav,
    ...appearanceNav,
    ...auditNav,
    ...schoolLifeNav,
    ...eventsNav,
    ...familiesNav,
    ...studentsNav,
    ...suppliesNav,
    ...reportsNav,
    ...classesNav,
    ...assessmentsNav,
    ...classroomNav,
    ...timetableNav,
    ...treasuryNav,
    ...transportNav,
  },
  permissions: {
    groups: {
      ...organizationPermissions.groups,
      ...schoolsPermissions.groups,
      ...schoolYearsPermissions.groups,
      ...usersPermissions.groups,
      ...accessPermissions.groups,
      ...configurationPermissions.groups,
      ...auditPermissions.groups,
      ...hrPermissions.groups,
      ...schoolLifePermissions.groups,
      ...eventsPermissions.groups,
      ...familiesPermissions.groups,
      ...studentsPermissions.groups,
      ...suppliesPermissions.groups,
      ...documentsPermissions.groups,
      ...importsPermissions.groups,
      ...reportsPermissions.groups,
      ...enrolmentPermissions.groups,
      ...classesPermissions.groups,
      ...assessmentsPermissions.groups,
      ...classroomPermissions.groups,
      ...timetablePermissions.groups,
      ...treasuryPermissions.groups,
      ...transportPermissions.groups,
    },
    codes: {
      ...organizationPermissions.codes,
      ...schoolsPermissions.codes,
      ...schoolYearsPermissions.codes,
      ...usersPermissions.codes,
      ...accessPermissions.codes,
      ...configurationPermissions.codes,
      ...auditPermissions.codes,
      ...hrPermissions.codes,
      ...schoolLifePermissions.codes,
      ...eventsPermissions.codes,
      ...familiesPermissions.codes,
      ...studentsPermissions.codes,
      ...suppliesPermissions.codes,
      ...documentsPermissions.codes,
      ...importsPermissions.codes,
      ...reportsPermissions.codes,
      ...enrolmentPermissions.codes,
      ...classesPermissions.codes,
      ...assessmentsPermissions.codes,
      ...classroomPermissions.codes,
      ...timetablePermissions.codes,
      ...treasuryPermissions.codes,
      ...transportPermissions.codes,
    },
  },
};

export default fr;
