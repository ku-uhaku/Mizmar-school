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
      // Prepares announcements but does not send them: publishing to every
      // family is the director's call, in their own school.
      PERMISSIONS.EVENT_VIEW,
      PERMISSIONS.EVENT_MANAGE,
      PERMISSIONS.FAMILY_VIEW,
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.ENROLMENT_VIEW,
      PERMISSIONS.CLASS_VIEW,
      PERMISSIONS.CLASS_ASSIGN_TEACHER,
      // Sets the calendar of contrôles and releases the marks — this is the
      // pedagogical side they are answerable for. Not ASSESSMENT_GRADE: marking
      // a paper is the teacher's job, not theirs.
      PERMISSIONS.ASSESSMENT_VIEW,
      PERMISSIONS.ASSESSMENT_MANAGE,
      PERMISSIONS.ASSESSMENT_PUBLISH,
      // Runs the class councils of the schools they oversee and awards the
      // mentions. Not BULLETIN_PUBLISH, for the same reason as EVENT_PUBLISH:
      // handing a document to every family is the director's call in their own
      // school. Not BULLETIN_APPRECIATE either — the line about a pupil in
      // Maths belongs to whoever teaches them Maths.
      PERMISSIONS.BULLETIN_VIEW,
      PERMISSIONS.BULLETIN_COMPUTE,
      PERMISSIONS.BULLETIN_COUNCIL,
      // Checks a MASSAR sheet and fills one from our marks, across the schools
      // they oversee. Not MASSAR_IMPORT, which writes marks, and not MASSAR_MAP:
      // deciding that this class *is* that class in the ministry's records is
      // the school's own call, not the inspectorate's.
      PERMISSIONS.MASSAR_RECONCILE,
      PERMISSIONS.MASSAR_EXPORT,
      // Reads the registers and the carnets of the schools they oversee, and
      // writes in neither — they are not in the room.
      PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW,
      PERMISSIONS.CLASSROOM_REMARK_VIEW,
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
      // Reads the parents' space and can take a message out of it — the power
      // that makes opening the space to families a defensible decision.
      PERMISSIONS.CHAT_VIEW,
      PERMISSIONS.CHAT_MODERATE,
      // Announces to the families of their own school, and is answerable for it.
      PERMISSIONS.EVENT_VIEW,
      PERMISSIONS.EVENT_MANAGE,
      PERMISSIONS.EVENT_PUBLISH,
      PERMISSIONS.EVENT_DELETE,
      PERMISSIONS.FAMILY_VIEW,
      PERMISSIONS.FAMILY_CREATE,
      PERMISSIONS.FAMILY_UPDATE,
      PERMISSIONS.FAMILY_DELETE,
      // Opens the parents' app to a household, and withdraws it again.
      PERMISSIONS.FAMILY_PORTAL,
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
      // The whole of the marking cycle in their own school, including entering
      // a mark themselves when a post is vacant.
      PERMISSIONS.ASSESSMENT_VIEW,
      PERMISSIONS.ASSESSMENT_MANAGE,
      PERMISSIONS.ASSESSMENT_GRADE,
      PERMISSIONS.ASSESSMENT_PUBLISH,
      PERMISSIONS.ASSESSMENT_DELETE,
      // The bulletins of their own school end to end, publication included —
      // issuing them is precisely what a head is answerable for.
      PERMISSIONS.BULLETIN_VIEW,
      PERMISSIONS.BULLETIN_COMPUTE,
      PERMISSIONS.BULLETIN_APPRECIATE,
      PERMISSIONS.BULLETIN_COUNCIL,
      PERMISSIONS.BULLETIN_PUBLISH,
      // The whole MASSAR round trip, mapping included. Adopting the ministry's
      // codes onto a class is the one step nobody else here gets, because
      // everything filed afterwards depends on it having been got right.
      PERMISSIONS.MASSAR_RECONCILE,
      PERMISSIONS.MASSAR_IMPORT,
      PERMISSIONS.MASSAR_EXPORT,
      PERMISSIONS.MASSAR_MAP,
      // Including the two decisions a teacher does not get: accepting a
      // justification, and releasing a remark to the family.
      PERMISSIONS.CLASSROOM_WORKSPACE,
      PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW,
      PERMISSIONS.CLASSROOM_ATTENDANCE_MARK,
      PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY,
      PERMISSIONS.CLASSROOM_REMARK_VIEW,
      PERMISSIONS.CLASSROOM_REMARK_WRITE,
      PERMISSIONS.CLASSROOM_REMARK_PUBLISH,
      // Both halves of the fournitures: a head may write a list, and is who
      // decides whether parents are asked to buy it.
      PERMISSIONS.SUPPLY_VIEW,
      PERMISSIONS.SUPPLY_WRITE,
      PERMISSIONS.SUPPLY_REVIEW,
      PERMISSIONS.SUPPLY_DELETE,
      // The dossier d'inscription, both ends: a head answers for what the
      // school accepted and for waiving a pièce a family cannot produce.
      PERMISSIONS.DOCUMENT_VIEW,
      PERMISSIONS.DOCUMENT_MANAGE,
      // Loading the year's list from a spreadsheet. Held with STUDENT_CREATE
      // and FAMILY_CREATE above, which the import action asserts alongside it.
      PERMISSIONS.IMPORT_STUDENTS,
      // The reporting screen. What it actually shows is still gated report by
      // report on the data's own code — see modules/reports/catalogue.ts.
      PERMISSIONS.REPORT_VIEW,
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
      // The logistics, end to end — including agreeing to what the buses burn,
      // which is a spend and so belongs with whoever answers for the caisse.
      PERMISSIONS.TRANSPORT_VIEW,
      PERMISSIONS.TRANSPORT_MANAGE,
      PERMISSIONS.TRANSPORT_SUBSCRIBE,
      PERMISSIONS.TRANSPORT_DELETE,
      PERMISSIONS.TRANSPORT_ATTENDANCE,
      PERMISSIONS.TRANSPORT_FUEL,
      PERMISSIONS.TRANSPORT_FUEL_APPROVE,
      // The trail of their own school. A head is who a family asks "who changed
      // my child's fee?", so they are who has to be able to answer it —
      // narrowed to their school by the read itself, since the code is not held
      // org-wide. Not AUDIT_SECURITY: who tried to sign in is the
      // administrator's business, not the school's.
      PERMISSIONS.AUDIT_VIEW,
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
      // Reads the parents' space; removing from it is the director's.
      PERMISSIONS.CHAT_VIEW,
      // Types the réunion up; somebody answerable presses Publish.
      PERMISSIONS.EVENT_VIEW,
      PERMISSIONS.EVENT_MANAGE,
      PERMISSIONS.FAMILY_VIEW,
      PERMISSIONS.FAMILY_CREATE,
      PERMISSIONS.FAMILY_UPDATE,
      // Hands a family its login at the guichet, which is where a parent asks
      // for it. The account carries no role and reaches one dossier — see the
      // note in modules/families/permissions.ts.
      PERMISSIONS.FAMILY_PORTAL,
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.STUDENT_CREATE,
      PERMISSIONS.STUDENT_UPDATE,
      PERMISSIONS.ENROLMENT_VIEW,
      PERMISSIONS.ENROLMENT_CREATE,
      PERMISSIONS.ENROLMENT_UPDATE,
      // The guichet: the papers cross this desk, so this is where the dossier
      // is recorded. It is also what tells the secretary an inscription cannot
      // proceed yet.
      PERMISSIONS.DOCUMENT_VIEW,
      PERMISSIONS.DOCUMENT_MANAGE,
      // Rentrée is a spreadsheet from the previous school or from MASSAR, and
      // typing four hundred pupils by hand is this desk's worst week.
      PERMISSIONS.IMPORT_STUDENTS,
      // The reporting screen. What it actually shows is still gated report by
      // report on the data's own code — see modules/reports/catalogue.ts.
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.CLASS_VIEW,
      PERMISSIONS.CLASS_ROSTER,
      // Reads the calendar of contrôles to answer a parent on the phone, and
      // enters no mark: a mark is the teacher's, and the desk is not where it
      // gets decided.
      PERMISSIONS.ASSESSMENT_VIEW,
      // Reads a bulletin to reprint one for a family at the desk, and decides
      // nothing on it.
      PERMISSIONS.BULLETIN_VIEW,
      // May check whether a MASSAR sheet is the right class — the question the
      // desk gets asked — and may act on none of it.
      PERMISSIONS.MASSAR_RECONCILE,
      // The office end of the register: chasing absences and filing the
      // justifications families bring in. Marking itself stays with whoever was
      // in the room.
      PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW,
      PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY,
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
      // Calls the bus roll when a driver has no account of their own, and
      // types up their fuel slips. Deliberately without
      // TRANSPORT_FUEL_APPROVE: recording a spend and agreeing to it are the
      // two halves a caisse exists to keep apart.
      PERMISSIONS.TRANSPORT_ATTENDANCE,
      PERMISSIONS.TRANSPORT_FUEL,
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
      // Marks the papers set for their classes. Deliberately not
      // ASSESSMENT_MANAGE or ASSESSMENT_PUBLISH: a teacher marks the round the
      // head of studies planned, and does not decide when the marks are
      // released.
      PERMISSIONS.ASSESSMENT_VIEW,
      PERMISSIONS.ASSESSMENT_GRADE,
      // Writes the appreciation for their own subject on a bulletin. Not
      // BULLETIN_COUNCIL: saying a pupil must work harder is not the same
      // authority as deciding they repeat the year, and that split is the whole
      // reason the two codes exist.
      PERMISSIONS.BULLETIN_VIEW,
      PERMISSIONS.BULLETIN_APPRECIATE,
      PERMISSIONS.TIMETABLE_VIEW,
      // The espace enseignant: their own classes, their own registers, their
      // own carnet. Not ATTENDANCE_JUSTIFY — a teacher records that a child was
      // not there, and the office decides whether the note excuses it. Not
      // REMARK_PUBLISH either: a concern goes to the family once the school has
      // decided what to say, not the moment it is written.
      PERMISSIONS.CLASSROOM_WORKSPACE,
      PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW,
      PERMISSIONS.CLASSROOM_ATTENDANCE_MARK,
      PERMISSIONS.CLASSROOM_REMARK_VIEW,
      PERMISSIONS.CLASSROOM_REMARK_WRITE,
      // Writes a liste de fournitures for their own class; releasing it to
      // families is the office's decision, so not SUPPLY_REVIEW.
      PERMISSIONS.SUPPLY_VIEW,
      PERMISSIONS.SUPPLY_WRITE,
      // Reads a dossier to know why a certificat cannot be issued yet, and
      // records nothing: the papers cross the guichet, not the staffroom.
      PERMISSIONS.DOCUMENT_VIEW,
    ],
  },
  {
    name: "Chauffeur",
    description: "Ses circuits du jour et l'appel au marchepied.",
    scope: "SCHOOL",
    permissions: [
      // A membership at all, because the school year a run belongs to is
      // resolved from the working context — a driver with no membership would
      // see an empty day rather than their circuit.
      PERMISSIONS.SCHOOL_VIEW,
      PERMISSIONS.SCHOOL_YEAR_VIEW,
      // Their own runs and the children holding a seat on them. Not
      // TRANSPORT_MANAGE and not TRANSPORT_SUBSCRIBE: a chauffeur drives the
      // line, they do not draw it or put a child on it.
      PERMISSIONS.TRANSPORT_VIEW,
      PERMISSIONS.TRANSPORT_ATTENDANCE,
      // Posts what the bus drank, from the station. The bursar still approves —
      // TRANSPORT_FUEL_APPROVE is deliberately not here.
      PERMISSIONS.TRANSPORT_FUEL,
    ],
  },
];
