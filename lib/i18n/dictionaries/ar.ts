import type { Dictionary } from "@/lib/i18n/types";

import core, { nav as coreNav } from "@/lib/i18n/core/ar";
import access, {
  nav as accessNav,
  permissions as accessPermissions,
} from "@/modules/access/i18n/ar";
import appearance, { nav as appearanceNav } from "@/modules/appearance/i18n/ar";
import audit, {
  nav as auditNav,
  permissions as auditPermissions,
} from "@/modules/audit/i18n/ar";
import auth from "@/modules/auth/i18n/ar";
import configuration, {
  nav as configurationNav,
  permissions as configurationPermissions,
} from "@/modules/configuration/i18n/ar";
import context from "@/modules/context/i18n/ar";
import hr, {
  nav as hrNav,
  permissions as hrPermissions,
} from "@/modules/hr/i18n/ar";
import dashboard, { nav as dashboardNav } from "@/modules/dashboard/i18n/ar";
import organization, {
  nav as organizationNav,
  permissions as organizationPermissions,
} from "@/modules/organization/i18n/ar";
import notifications, {
  nav as notificationsNav,
} from "@/modules/notifications/i18n/ar";
import profile, { nav as profileNav } from "@/modules/profile/i18n/ar";
import schoolYears, {
  nav as schoolYearsNav,
  permissions as schoolYearsPermissions,
} from "@/modules/school-years/i18n/ar";
import setup from "@/modules/setup/i18n/ar";
import schools, {
  nav as schoolsNav,
  permissions as schoolsPermissions,
} from "@/modules/schools/i18n/ar";
import users, {
  nav as usersNav,
  permissions as usersPermissions,
} from "@/modules/users/i18n/ar";
import classes, {
  nav as classesNav,
  permissions as classesPermissions,
} from "@/modules/classes/i18n/ar";
import assessments, {
  nav as assessmentsNav,
  permissions as assessmentsPermissions,
} from "@/modules/assessments/i18n/ar";
import bulletins, {
  nav as bulletinsNav,
  permissions as bulletinsPermissions,
} from "@/modules/bulletins/i18n/ar";
import massar, {
  nav as massarNav,
  permissions as massarPermissions,
} from "@/modules/massar/i18n/ar";
import classroom, {
  nav as classroomNav,
  permissions as classroomPermissions,
} from "@/modules/classroom/i18n/ar";
import enrolment, {
  permissions as enrolmentPermissions,
} from "@/modules/enrolment/i18n/ar";
import families, {
  nav as familiesNav,
  permissions as familiesPermissions,
} from "@/modules/families/i18n/ar";
import chat, {
  nav as chatNav,
  permissions as chatPermissions,
} from "@/modules/chat/i18n/ar";
import requests, {
  nav as requestsNav,
  permissions as requestsPermissions,
} from "@/modules/requests/i18n/ar";
import events, {
  nav as eventsNav,
  permissions as eventsPermissions,
} from "@/modules/events/i18n/ar";
import schoolLife, {
  nav as schoolLifeNav,
  permissions as schoolLifePermissions,
} from "@/modules/school-life/i18n/ar";
import supplies, {
  nav as suppliesNav,
  permissions as suppliesPermissions,
} from "@/modules/supplies/i18n/ar";
import documents, {
  permissions as documentsPermissions,
} from "@/modules/documents/i18n/ar";
import imports, {
  permissions as importsPermissions,
} from "@/modules/imports/i18n/ar";
import reports, {
  nav as reportsNav,
  permissions as reportsPermissions,
} from "@/modules/reports/i18n/ar";
import students, {
  nav as studentsNav,
  permissions as studentsPermissions,
} from "@/modules/students/i18n/ar";
import timetable, {
  nav as timetableNav,
  permissions as timetablePermissions,
} from "@/modules/timetable/i18n/ar";
import treasury, {
  nav as treasuryNav,
  permissions as treasuryPermissions,
} from "@/modules/treasury/i18n/ar";
import transport, {
  nav as transportNav,
  permissions as transportPermissions,
} from "@/modules/transport/i18n/ar";

/**
 * Arabic. Assembled exactly like `en.ts` — see that file for the registration
 * steps. The `Dictionary` annotation is what reports a missing or misspelt key.
 *
 * The interface flips to RTL for this locale; that is driven by
 * `LOCALE_META.ar.dir` in lib/i18n/config.ts, not by anything here.
 */
const ar: Dictionary = {
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
  ...setup,
  ...hr,
  ...profile,
  ...appearance,
  ...notifications,
  ...audit,

  // Vie scolaire.
  ...schoolLife,
  ...events,
  ...requests,
  ...chat,
  ...families,
  ...students,
  ...supplies,
  ...documents,
  ...imports,
  ...reports,
  ...enrolment,
  ...classes,
  ...assessments,
  ...bulletins,
  ...massar,
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
    ...notificationsNav,
    ...auditNav,
    ...schoolLifeNav,
    ...eventsNav,
    ...requestsNav,
    ...chatNav,
    ...familiesNav,
    ...studentsNav,
    ...suppliesNav,
    ...reportsNav,
    ...classesNav,
    ...assessmentsNav,
    ...bulletinsNav,
    ...massarNav,
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
      ...requestsPermissions.groups,
      ...chatPermissions.groups,
      ...familiesPermissions.groups,
      ...studentsPermissions.groups,
      ...suppliesPermissions.groups,
      ...documentsPermissions.groups,
      ...importsPermissions.groups,
      ...reportsPermissions.groups,
      ...enrolmentPermissions.groups,
      ...classesPermissions.groups,
      ...assessmentsPermissions.groups,
      ...bulletinsPermissions.groups,
      ...massarPermissions.groups,
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
      ...requestsPermissions.codes,
      ...chatPermissions.codes,
      ...familiesPermissions.codes,
      ...studentsPermissions.codes,
      ...suppliesPermissions.codes,
      ...documentsPermissions.codes,
      ...importsPermissions.codes,
      ...reportsPermissions.codes,
      ...enrolmentPermissions.codes,
      ...classesPermissions.codes,
      ...assessmentsPermissions.codes,
      ...bulletinsPermissions.codes,
      ...massarPermissions.codes,
      ...classroomPermissions.codes,
      ...timetablePermissions.codes,
      ...treasuryPermissions.codes,
      ...transportPermissions.codes,
    },
  },
};

export default ar;
