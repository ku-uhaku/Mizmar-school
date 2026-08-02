import { dueDayOf, settingsOf } from "@/lib/school-settings";
import { monthsOfYear, startOfMonth } from "@/modules/enrolment/enums";
import { buildScheduleLines } from "@/modules/enrolment/schedule";
import { deriveStudentStatus } from "@/modules/students/enums";
import { log, type SeedDb } from "@/prisma/seed/client";

/**
 * Inscriptions for the running year, and the fee schedules they generate.
 *
 * The pupils are matched to a level by age and seated in the emptiest of that
 * level's classes, so an intake sized to the classes fills them evenly and one
 * sized to anything else fills them the way a real rentrée does.
 *
 * Prices come from `buildScheduleLines`, the same pure function the enrolment
 * action uses. A seed that priced pupils by its own logic would produce demo
 * data the app itself could never have produced.
 */

/**
 * Which level a child of a given age belongs in, by the Moroccan calendar:
 * 6 years old starts 1AP, and each year after that moves up one.
 *
 * Returns the *grade year within a cycle*, which is what `Level.gradeYear`
 * holds, together with the cycle to look it up in.
 */
function placementFor(
  age: number,
): { cycle: string; gradeYear: number } | null {
  if (age >= 4 && age <= 5) return { cycle: "PRESCHOOL", gradeYear: age - 3 };
  if (age >= 6 && age <= 11) return { cycle: "PRIMARY", gradeYear: age - 5 };
  if (age >= 12 && age <= 14) {
    return { cycle: "SECONDARY_COLLEGE", gradeYear: age - 11 };
  }
  if (age >= 15 && age <= 17) {
    return { cycle: "SECONDARY_QUALIFYING", gradeYear: age - 14 };
  }
  return null;
}

export async function seedEnrolments(
  db: SeedDb,
  {
    schoolId,
    schoolYearId,
    students,
    /**
     * Leave every nth pupil without a class, to exercise the dashboard's
     * "awaiting a class" figure. Null seats everybody, which is what a roster
     * sized to fill the classes exactly wants.
     */
    unseatedEvery = null,
  }: {
    schoolId: string;
    schoolYearId: string;
    /** Matricule → id and age, as returned by `seedStudents`. */
    students: Record<string, { id: string; age: number }>;
    unseatedEvery?: number | null;
  },
): Promise<void> {
  const year = await db.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: {
      startDate: true,
      endDate: true,
      _count: { select: { terms: true } },
    },
  });
  if (!year) return;

  // Bound by the same conventions as the app — a seed that priced pupils on its
  // own numbers would produce demo data the app could never have produced.
  //
  // Read through the seed's own client rather than `loadSchoolSettings`: that
  // helper is `server-only`, and the seed runs under tsx outside Next.
  const settings = settingsOf(
    await db.schoolSettings.findUnique({ where: { schoolId } }),
  );

  const [offerings, feeTypes, rates] = await Promise.all([
    db.levelOffering.findMany({
      where: { schoolYearId, isActive: true },
      select: {
        id: true,
        levelId: true,
        level: {
          select: {
            gradeYear: true,
            educationLevel: { select: { cycle: true } },
          },
        },
        classes: {
          where: { isActive: true },
          orderBy: { code: "asc" },
          select: {
            id: true,
            capacity: true,
            _count: { select: { enrollments: true } },
          },
        },
      },
    }),
    db.feeType.findMany({
      where: { schoolId, isActive: true },
      orderBy: [{ position: "asc" }, { code: "asc" }],
      select: { id: true, kind: true, billingCycle: true, isMandatory: true },
    }),
    db.feeRate.findMany({
      where: { schoolYearId, isActive: true },
      select: {
        id: true,
        feeTypeId: true,
        amountCentimes: true,
        instalmentCount: true,
        scopeKey: true,
      },
    }),
  ]);

  // Seats taken so far, so several pupils placed in one run still spread across
  // the parallel classes instead of all landing in the first.
  const seatsTaken = new Map<string, number>(
    offerings.flatMap((offering) =>
      offering.classes.map(
        (schoolClass) =>
          [schoolClass.id, schoolClass._count.enrollments] as const,
      ),
    ),
  );

  let enrolled = 0;
  let unseated = 0;
  let feeLines = 0;

  // The month a mid-year canteen subscription starts in the demo data. Read off
  // the year's own months rather than named, so a school year that opens in
  // October still gets a plausible one.
  const startsFromThirdMonth = (() => {
    const month = monthsOfYear(year.startDate, year.endDate)[2];
    return month ? startOfMonth(month) : null;
  })();

  for (const student of Object.values(students)) {
    const placement = placementFor(student.age);
    if (!placement) continue;

    const offering = offerings.find(
      (candidate) =>
        candidate.level.educationLevel.cycle === placement.cycle &&
        candidate.level.gradeYear === placement.gradeYear,
    );
    // The school does not run that level this year — the child stays a file
    // with no place, which is a state the app has to handle anyway.
    if (!offering) continue;

    const leaveUnseated =
      unseatedEvery !== null && enrolled % unseatedEvery === unseatedEvery - 1;

    const emptiest = leaveUnseated
      ? null
      : [...offering.classes].sort(
          (a, b) => (seatsTaken.get(a.id) ?? 0) - (seatsTaken.get(b.id) ?? 0),
        )[0];

    // Options are subscribed by a stable rule rather than at random, so a
    // re-seed produces the same schedule and the counts below stay meaningful.
    const usesTransport = student.age >= 12;
    const usesCanteen = student.age <= 11;

    // Every seventh canteen family joins after the rentrée, so the demo data
    // contains the mid-year case the fee grid and the payment tab have to cope
    // with — a short échéancier next to full ones. Keyed off the same counter
    // as `leaveUnseated`, so a re-seed picks the same families.
    const canteenStartsOn =
      usesCanteen && enrolled % 7 === 3
        ? (startsFromThirdMonth ?? null)
        : null;

    const enrolment = await db.enrollment.upsert({
      where: {
        studentId_schoolYearId: { studentId: student.id, schoolYearId },
      },
      update: {},
      create: {
        studentId: student.id,
        schoolYearId,
        levelOfferingId: offering.id,
        schoolClassId: emptiest?.id ?? null,
        status: "ACTIVE",
        enrolledOn: year.startDate,
        usesTransport,
        usesCanteen,
        canteenStartsOn,
      },
      select: { id: true, schoolClassId: true },
    });

    if (enrolment.schoolClassId) {
      seatsTaken.set(
        enrolment.schoolClassId,
        (seatsTaken.get(enrolment.schoolClassId) ?? 0) + 1,
      );
    } else {
      unseated += 1;
    }

    // The échéancier, from the same rule the action uses. Only the lines that
    // are missing get written, so re-running is a no-op.
    const lines = buildScheduleLines({
      levelId: offering.levelId,
      usesTransport,
      usesCanteen,
      transportStartsOn: null,
      canteenStartsOn,
      yearStart: year.startDate,
      yearEnd: year.endDate,
      termCount: year._count.terms,
      feeTypes,
      rates,
      instalmentsPerYear: settings.defaultInstalmentCount,
      dueDayOfMonth: dueDayOf(settings),
    });

    const existing = await db.enrollmentFee.findMany({
      where: { enrollmentId: enrolment.id },
      select: { feeTypeId: true, periodIndex: true },
    });
    const taken = new Set(
      existing.map((line) => `${line.feeTypeId}:${line.periodIndex}`),
    );
    const fresh = lines.filter(
      (line) => !taken.has(`${line.feeTypeId}:${line.periodIndex}`),
    );

    if (fresh.length > 0) {
      await db.enrollmentFee.createMany({
        data: fresh.map((line) => ({ ...line, enrollmentId: enrolment.id })),
      });
      feeLines += fresh.length;
    }

    // `Student.status` is derived — set it the way the service does, never by
    // hand. See modules/students/service.ts.
    await db.student.update({
      where: { id: student.id },
      data: { status: deriveStudentStatus([{ status: "ACTIVE" }]) },
    });

    enrolled += 1;
  }

  log(
    "enrolments",
    `${enrolled} inscribed (${unseated} awaiting a class), ${feeLines} fee lines`,
  );
}
