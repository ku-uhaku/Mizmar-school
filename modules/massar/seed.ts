import { offeringScopeKey } from "@/modules/classes/enums";
import { deriveStudentStatus } from "@/modules/students/enums";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * The cohort a real MASSAR export is about, so the round trip can be run
 * end to end without a school's live data.
 *
 * ── Why this exists as its own school ───────────────────────────────────────
 * `147610.xlsx` is a genuine NotesCC export: سما أدمين الخصوصية in Inezgane,
 * class 2APG-1, mathématiques, deuxième semestre, 2022/2023. None of that is Al
 * Manar Oujda, and folding twenty-six children from another establishment into
 * the demo school would be a lie the reconciliation is specifically built to
 * catch. So it seeds the school the file actually names, and the admin switches
 * to it in the header — which also demonstrates that the checks scope to the
 * school in context rather than to whatever code the file carries.
 *
 * ── What it deliberately leaves unmapped ────────────────────────────────────
 * The class's `massarCode`, the terms' and every pupil's `massarNumber` are left
 * null. They are exactly what "Adopt MASSAR's codes" fills in, and seeding them
 * would leave that direction with nothing to do and nothing to show. The subject
 * is the one exception: `loadMassarContext` *finds* the subject by its MASSAR
 * code, so leaving it null would block the file on `SUBJECT` rather than teach
 * anybody anything.
 *
 * No contrôle is seeded either — "Create the contrôle" is the first of the four
 * directions, and it takes the file's own scale of 10.
 *
 * Owns none of these tables. It is a fixture, not a domain: it writes through
 * the same uniques and the same derived-column helpers the owning modules use,
 * so re-running it changes nothing.
 */

/** The establishment as MASSAR names it in the hidden `C5`. */
const SCHOOL = {
  code: "SAMA-INEZGANE",
  name: "سما أدمين الخصوصية",
  massarCode: "53747V",
  level: "PRIMARY",
  city: "Inezgane",
  region: "Souss-Massa",
  addressLine: "عمالة إنزكان ايت ملول",
  directorName: "براح الصالحة",
} as const;

const YEAR_NAME = "2022/2023";

/**
 * The class list, straight off the sheet.
 *
 * `massarCode` and the Arabic name are the file's own; the Latin spelling is a
 * transliteration, because `Student.firstName` is required and a class list from
 * MASSAR is issued in Arabic only. `gender` is read from the given name for the
 * same reason — a mark sheet does not carry it, and the column is not nullable.
 *
 * Birth dates are the file's, to the day: `PUPIL_BIRTH_DATE` is one of the
 * checks, and a fixture that got them wrong would fail its own demonstration.
 */
const PUPILS: {
  massarCode: string;
  lastNameAr: string;
  firstNameAr: string;
  lastName: string;
  firstName: string;
  gender: "MALE" | "FEMALE";
  /** dd-mm-yyyy, as the sheet writes it. */
  birthDate: string;
}[] = [
  { massarCode: "R185066146", lastNameAr: "تويهر", firstNameAr: "يوسف", lastName: "Touiher", firstName: "Youssef", gender: "MALE", birthDate: "08-07-2015" },
  { massarCode: "R186060922", lastNameAr: "الطوسي", firstNameAr: "ياسمين", lastName: "Ettoussi", firstName: "Yasmine", gender: "FEMALE", birthDate: "03-04-2015" },
  { massarCode: "R188070332", lastNameAr: "مخزاني", firstNameAr: "جاد", lastName: "Makhzani", firstName: "Jad", gender: "MALE", birthDate: "26-10-2015" },
  { massarCode: "R189075020", lastNameAr: "انجار", firstNameAr: "عصماء", lastName: "Anjar", firstName: "Asmaa", gender: "FEMALE", birthDate: "06-01-2016" },
  { massarCode: "R193002347", lastNameAr: "محاق", firstNameAr: "مروى", lastName: "Mhaq", firstName: "Marwa", gender: "FEMALE", birthDate: "19-02-2016" },
  { massarCode: "R194070542", lastNameAr: "الحنصالي", firstNameAr: "انس", lastName: "El Hansali", firstName: "Anas", gender: "MALE", birthDate: "07-10-2015" },
  { massarCode: "R195002346", lastNameAr: "محاق", firstNameAr: "دعاء", lastName: "Mhaq", firstName: "Doua", gender: "FEMALE", birthDate: "21-01-2016" },
  { massarCode: "R195064237", lastNameAr: "الراجي", firstNameAr: "سلسبيل", lastName: "Erraji", firstName: "Salsabil", gender: "FEMALE", birthDate: "06-06-2015" },
  { massarCode: "R197054157", lastNameAr: "العابد", firstNameAr: "ادم", lastName: "El Abed", firstName: "Adam", gender: "MALE", birthDate: "30-08-2015" },
  { massarCode: "R198044248", lastNameAr: "تيشوة", firstNameAr: "أنس", lastName: "Tichoua", firstName: "Anas", gender: "MALE", birthDate: "21-03-2016" },
  { massarCode: "R199032232", lastNameAr: "باكري", firstNameAr: "ريان", lastName: "Bakri", firstName: "Rayane", gender: "MALE", birthDate: "26-07-2015" },
  { massarCode: "R203071091", lastNameAr: "عدنان", firstNameAr: "رضا", lastName: "Adnane", firstName: "Rida", gender: "MALE", birthDate: "19-05-2015" },
  { massarCode: "R209062980", lastNameAr: "رحيوي", firstNameAr: "دعاء", lastName: "Rahioui", firstName: "Doua", gender: "FEMALE", birthDate: "12-03-2016" },
  { massarCode: "R209069762", lastNameAr: "الدعينن", firstNameAr: "ياسين", lastName: "Eddainane", firstName: "Yassine", gender: "MALE", birthDate: "21-12-2015" },
  { massarCode: "R212052818", lastNameAr: "ابني", firstNameAr: "فاطمة الزهراء", lastName: "Abni", firstName: "Fatima Zahra", gender: "FEMALE", birthDate: "01-01-2016" },
  { massarCode: "R213019909", lastNameAr: "لهنود", firstNameAr: "محمد", lastName: "Lahnoud", firstName: "Mohamed", gender: "MALE", birthDate: "04-11-2015" },
  { massarCode: "R213030729", lastNameAr: "لاشر", firstNameAr: "عبد الرحمان", lastName: "Lacher", firstName: "Abderrahmane", gender: "MALE", birthDate: "06-11-2015" },
  { massarCode: "R213077242", lastNameAr: "جوي", firstNameAr: "انصاف", lastName: "Joui", firstName: "Insaf", gender: "FEMALE", birthDate: "16-12-2014" },
  { massarCode: "R184056905", lastNameAr: "أفردوا", firstNameAr: "آدم", lastName: "Afardou", firstName: "Adam", gender: "MALE", birthDate: "02-06-2015" },
  { massarCode: "R191071207", lastNameAr: "صولدي", firstNameAr: "أميرة", lastName: "Souldi", firstName: "Amira", gender: "FEMALE", birthDate: "17-03-2016" },
  { massarCode: "R214066430", lastNameAr: "الزعيم", firstNameAr: "زينب", lastName: "Ezzaim", firstName: "Zineb", gender: "FEMALE", birthDate: "26-06-2015" },
  { massarCode: "R217075957", lastNameAr: "الكوط", firstNameAr: "وجدان", lastName: "El Kout", firstName: "Wijdane", gender: "FEMALE", birthDate: "01-06-2015" },
  { massarCode: "J194011366", lastNameAr: "الخياط", firstNameAr: "ايمن", lastName: "El Khayat", firstName: "Aymane", gender: "MALE", birthDate: "22-09-2015" },
  { massarCode: "R213054658", lastNameAr: "بوعق", firstNameAr: "لينة", lastName: "Bouaq", firstName: "Lina", gender: "FEMALE", birthDate: "13-01-2016" },
  { massarCode: "F219262436", lastNameAr: "موزون", firstNameAr: "حمزة", lastName: "Mouzoun", firstName: "Hamza", gender: "MALE", birthDate: "13-08-2014" },
  { massarCode: "R210017914", lastNameAr: "شكيري", firstNameAr: "اريج", lastName: "Chakiri", firstName: "Arij", gender: "FEMALE", birthDate: "23-10-2015" },
];

/** `"08-07-2015"` → UTC midnight, which is where every other date in the app sits. */
function parseDayFirst(value: string): Date {
  const [day, month, year] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export async function seedMassarDemo(db: SeedDb, organizationId: string) {
  // ── The establishment ─────────────────────────────────────────────────────
  const school = await db.school.upsert({
    where: { organizationId_code: { organizationId, code: SCHOOL.code } },
    // `update: {}` like every other school: a code corrected by hand survives.
    update: {},
    create: { organizationId, ...SCHOOL },
    select: { id: true },
  });
  await db.schoolSettings.upsert({
    where: { schoolId: school.id },
    update: {},
    create: { schoolId: school.id },
  });

  // ── The year and its two semesters ────────────────────────────────────────
  const year = await db.schoolYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: YEAR_NAME } },
    update: {},
    create: {
      schoolId: school.id,
      name: YEAR_NAME,
      startDate: new Date(Date.UTC(2022, 8, 1)),
      endDate: new Date(Date.UTC(2023, 6, 15)),
      status: "CLOSED",
      // The only year this school has, so it is what the context switcher lands
      // on — otherwise the file would fail SCHOOL_YEAR on arrival.
      isDefault: true,
    },
    select: { id: true },
  });

  for (const term of [
    { number: 1, name: "الدورة الأولى", start: [2022, 8, 1], end: [2023, 0, 31] },
    { number: 2, name: "الدورة الثانية", start: [2023, 1, 1], end: [2023, 6, 15] },
  ]) {
    await db.term.upsert({
      where: { schoolYearId_number: { schoolYearId: year.id, number: term.number } },
      update: {},
      create: {
        schoolYearId: year.id,
        number: term.number,
        name: term.name,
        nameAr: term.name,
        // massarCode left null on purpose — this is what "Adopt" fills in.
        startDate: new Date(Date.UTC(term.start[0], term.start[1], term.start[2])),
        endDate: new Date(Date.UTC(term.end[0], term.end[1], term.end[2])),
        status: "CLOSED",
      },
    });
  }

  // ── The cursus: one cycle, one level ──────────────────────────────────────
  const cycle = await db.educationLevel.upsert({
    where: { schoolId_cycle: { schoolId: school.id, cycle: "PRIMARY" } },
    update: {},
    create: {
      schoolId: school.id,
      cycle: "PRIMARY",
      name: "Enseignement primaire",
      nameAr: "التعليم الابتدائي",
    },
    select: { id: true },
  });

  const level = await db.level.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "2AP" } },
    update: {},
    create: {
      educationLevelId: cycle.id,
      schoolId: school.id,
      code: "2AP",
      name: "Deuxième année primaire",
      // Exactly the label in the sheet's `D9`, so the LEVEL check has something
      // recognisable to show beside it.
      nameAr: "الثاني ابتدائي عام",
      gradeYear: 2,
      position: 2,
    },
    select: { id: true },
  });

  /*
    The subject is the one mapping seeded already. `loadMassarContext` resolves
    the subject *by* its MASSAR code — the sheet identifies it as `#0019#` and
    nothing else — so a null here would block the file on SUBJECT and there
    would be nothing to demonstrate.
  */
  const subject = await db.subject.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "MATH" } },
    update: {},
    create: {
      schoolId: school.id,
      code: "MATH",
      name: "Mathématiques",
      nameAr: "الرياضيات",
      massarCode: "0019",
    },
    select: { id: true },
  });

  // ── The class ─────────────────────────────────────────────────────────────
  const scopeKey = offeringScopeKey(null);
  const offering = await db.levelOffering.upsert({
    where: {
      schoolYearId_levelId_scopeKey: { schoolYearId: year.id, levelId: level.id, scopeKey },
    },
    update: {},
    create: { schoolYearId: year.id, levelId: level.id, scopeKey, plannedCapacity: 30 },
    select: { id: true },
  });

  const schoolClass = await db.schoolClass.upsert({
    where: { levelOfferingId_code: { levelOfferingId: offering.id, code: "2APG-1" } },
    update: {},
    create: {
      levelOfferingId: offering.id,
      schoolId: school.id,
      // The code is what the sheet's `I9` says. `massarCode` stays null: the
      // CLASS check falls back to the school's own code and passes, which leaves
      // the mapping for "Adopt" to make explicit.
      code: "2APG-1",
      capacity: 30,
    },
    select: { id: true },
  });

  // The kind of paper a NotesCC sheet is filed as. Its default scale is 20 and
  // the file's is 10 — the contrôle takes the file's when it is created.
  await db.assessmentType.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "CC" } },
    update: {},
    create: {
      schoolId: school.id,
      code: "CC",
      name: "Contrôle continu",
      nameAr: "المراقبة المستمرة",
      defaultMaxScore: 20,
      gradesWholeSubject: true,
    },
  });

  // ── The twenty-six children ───────────────────────────────────────────────
  let enrolled = 0;
  for (const [index, pupil] of PUPILS.entries()) {
    const code = `E-2023-${String(index + 1).padStart(4, "0")}`;
    const data = {
      firstName: pupil.firstName,
      lastName: pupil.lastName,
      firstNameAr: pupil.firstNameAr,
      lastNameAr: pupil.lastNameAr,
      gender: pupil.gender,
      birthDate: parseDayFirst(pupil.birthDate),
      massarCode: pupil.massarCode,
      // `massarNumber` left null — the hidden `B` column is what "Adopt" writes.
      entryDate: new Date(Date.UTC(2022, 8, 1)),
    };

    const student = await db.student.upsert({
      where: { schoolId_code: { schoolId: school.id, code } },
      // `status` is absent here as everywhere: it is derived from the enrolments.
      update: data,
      create: { schoolId: school.id, code, ...data },
      select: { id: true },
    });

    await db.enrollment.upsert({
      where: { studentId_schoolYearId: { studentId: student.id, schoolYearId: year.id } },
      update: { schoolClassId: schoolClass.id },
      create: {
        studentId: student.id,
        schoolYearId: year.id,
        levelOfferingId: offering.id,
        schoolClassId: schoolClass.id,
        status: "ACTIVE",
        enrolledOn: new Date(Date.UTC(2022, 8, 1)),
      },
    });

    // Derived, set the way the service sets it — never typed into the form.
    await db.student.update({
      where: { id: student.id },
      data: { status: deriveStudentStatus([{ status: "ACTIVE" }]) },
    });

    enrolled += 1;
  }

  log("massar (démo NotesCC)", `${SCHOOL.name} · 2APG-1 · ${enrolled} élèves`);
  return { schoolId: school.id, schoolYearId: year.id, schoolClassId: schoolClass.id, subjectId: subject.id };
}
