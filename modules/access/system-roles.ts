import { ALL_PERMISSION_CODES, PERMISSIONS, type PermissionCode } from "@/lib/permissions";

/**
 * The roles created for a fresh organisation, upserted by `prisma/seed.ts`.
 *
 * `isSystem` roles can have their permissions tuned in the UI but cannot be
 * renamed or deleted, so the org always keeps a usable set of access levels.
 * Re-running the seed resets them to exactly what is declared here, which is
 * how drift in the built-in roles gets repaired.
 *
 * Names are the French labels an administrator sees; they are data, not
 * translation keys, because an org may rename its own non-system roles freely.
 */
export const SYSTEM_ROLES: {
  name: string;
  description: string;
  scope: "ORG" | "SCHOOL";
  permissions: PermissionCode[];
}[] = [
  {
    name: "Administrateur",
    description:
      "Accès complet à l'organisation, aux écoles, aux utilisateurs et aux rôles.",
    scope: "ORG",
    // Deliberately the whole catalogue: a new module's permissions are granted
    // to the administrator role on the next seed rather than silently omitted.
    permissions: ALL_PERMISSION_CODES,
  },
  {
    name: "Responsable pédagogique",
    description:
      "Consulte l'organisation et gère les écoles et les années scolaires.",
    scope: "ORG",
    permissions: [
      PERMISSIONS.ORGANIZATION_VIEW,
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_UPDATE,
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      PERMISSIONS.SCHOOL_YEAR_CREATE,
      PERMISSIONS.SCHOOL_YEAR_UPDATE,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.CONFIGURATION_VIEW,
      // Reads the whole vie scolaire across the schools they oversee, and runs
      // the pedagogical side of it — but does not touch fee schedules.
      PERMISSIONS.SCHOOL_LIFE_VIEW,
      PERMISSIONS.FAMILY_VIEW,
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.ENROLMENT_VIEW,
      PERMISSIONS.CLASS_VIEW,
      PERMISSIONS.CLASS_ASSIGN_TEACHER,
      PERMISSIONS.TIMETABLE_VIEW,
      PERMISSIONS.TIMETABLE_MANAGE,
      // Sees who staffs the schools they oversee, and marks nothing. Not
      // HR_PAYROLL: what a colleague earns is the head's business and the
      // bursar's, and that separation is the whole point of the code.
      PERMISSIONS.HR_VIEW,
    ],
  },
  {
    name: "Directeur d'école",
    description:
      "Gère son école : années scolaires, utilisateurs et affectations.",
    scope: "SCHOOL",
    permissions: [
      PERMISSIONS.ORGANIZATION_VIEW,
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_UPDATE,
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      PERMISSIONS.SCHOOL_YEAR_CREATE,
      PERMISSIONS.SCHOOL_YEAR_UPDATE,
      PERMISSIONS.SCHOOL_YEAR_DELETE,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_ASSIGN_ROLE,
      PERMISSIONS.ROLE_VIEW,
      // A director sets their own school up; the working context is what keeps
      // that confined to their school.
      PERMISSIONS.CONFIGURATION_VIEW,
      PERMISSIONS.CONFIGURATION_MANAGE,
      // The whole vie scolaire of their own school, fees included — a director
      // is who a family negotiates a reduction with.
      PERMISSIONS.SCHOOL_LIFE_VIEW,
      PERMISSIONS.FAMILY_VIEW,
      PERMISSIONS.FAMILY_CREATE,
      PERMISSIONS.FAMILY_UPDATE,
      PERMISSIONS.FAMILY_DELETE,
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.STUDENT_CREATE,
      PERMISSIONS.STUDENT_UPDATE,
      PERMISSIONS.STUDENT_DELETE,
      PERMISSIONS.ENROLMENT_VIEW,
      PERMISSIONS.ENROLMENT_CREATE,
      PERMISSIONS.ENROLMENT_UPDATE,
      PERMISSIONS.ENROLMENT_DELETE,
      PERMISSIONS.ENROLMENT_FEES,
      PERMISSIONS.CLASS_VIEW,
      PERMISSIONS.CLASS_ROSTER,
      PERMISSIONS.CLASS_ASSIGN_TEACHER,
      PERMISSIONS.TIMETABLE_VIEW,
      PERMISSIONS.TIMETABLE_MANAGE,
      // The whole caisse: a head runs the tills, pays out and answers for both.
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.TREASURY_SESSION,
      PERMISSIONS.TREASURY_COLLECT,
      PERMISSIONS.TREASURY_DISBURSE,
      PERMISSIONS.TREASURY_TRANSFER,
      PERMISSIONS.TREASURY_CHEQUES,
      PERMISSIONS.TREASURY_CANCEL,
      // The RH of their own school, salaries included — a head is who signs a
      // contract and answers for the payroll.
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.HR_MANAGE,
      PERMISSIONS.HR_ATTENDANCE,
      PERMISSIONS.HR_PAYROLL,
      PERMISSIONS.HR_DELETE,
      // The logistics, end to end.
      PERMISSIONS.TRANSPORT_VIEW,
      PERMISSIONS.TRANSPORT_MANAGE,
      PERMISSIONS.TRANSPORT_SUBSCRIBE,
      PERMISSIONS.TRANSPORT_DELETE,
    ],
  },
  {
    name: "Secrétaire",
    description: "Consulte et met à jour les données courantes de son école.",
    scope: "SCHOOL",
    permissions: [
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      PERMISSIONS.USER_VIEW,
      // The desk job: opens files, enrols, seats pupils in classes. Not
      // ENROLMENT_FEES — what a family is charged is the bursar's, and the
      // whole point of that code being separate.
      PERMISSIONS.SCHOOL_LIFE_VIEW,
      PERMISSIONS.FAMILY_VIEW,
      PERMISSIONS.FAMILY_CREATE,
      PERMISSIONS.FAMILY_UPDATE,
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.STUDENT_CREATE,
      PERMISSIONS.STUDENT_UPDATE,
      PERMISSIONS.ENROLMENT_VIEW,
      PERMISSIONS.ENROLMENT_CREATE,
      PERMISSIONS.ENROLMENT_UPDATE,
      PERMISSIONS.CLASS_VIEW,
      PERMISSIONS.CLASS_ROSTER,
      PERMISSIONS.TIMETABLE_VIEW,
      // Takes money at the desk and holds the drawer for the shift — but may
      // not pay any out, move it, or cancel a receipt once written. That
      // separation is the whole of a small school's internal control, and it is
      // why those codes exist apart from TREASURY_COLLECT.
      PERMISSIONS.TREASURY_VIEW,
      PERMISSIONS.TREASURY_SESSION,
      PERMISSIONS.TREASURY_COLLECT,
      PERMISSIONS.TREASURY_CHEQUES,
      // Marks the register every morning, which is desk work. Emphatically not
      // HR_PAYROLL: in most schools exactly two people may see what a colleague
      // earns, and the secretary is not one of them.
      PERMISSIONS.HR_VIEW,
      PERMISSIONS.HR_ATTENDANCE,
      // Puts children on a bus, which is desk work — but does not redraw the
      // lines or retire a vehicle, which is not.
      PERMISSIONS.TRANSPORT_VIEW,
      PERMISSIONS.TRANSPORT_SUBSCRIBE,
    ],
  },
  {
    name: "Enseignant",
    description: "Accès en lecture seule à son école.",
    scope: "SCHOOL",
    permissions: [
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      // Sees the pupils and the week they are taught, and nothing about money
      // or dossiers familiaux.
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.CLASS_VIEW,
      PERMISSIONS.TIMETABLE_VIEW,
    ],
  },
];
