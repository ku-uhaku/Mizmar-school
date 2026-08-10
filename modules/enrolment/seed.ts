import { dueDayOf, settingsOf } from "@/lib/school-settings";
import { monthsOfYear, netAmount, startOfMonth } from "@/modules/enrolment/enums";
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
        perInstalment: true,
        scopeKey: true,
      },
    }),
  ]);

  /*
    The two charges the demo subscribes people to, found in the school's own
    catalogue rather than assumed. `kind` is the right key here for the same
    reason it is in the services report: the seed is choosing *the bus* and *the
    cantine* specifically, not "whatever is optional". A school seeded without
    them simply has no subscribers.
  */
  const optionalOf = (kind: string) =>
    feeTypes.find((feeType) => feeType.kind === kind && !feeType.isMandatory) ??
    null;
  const transportCharge = optionalOf("TRANSPORT");
  const canteenCharge = optionalOf("CANTEEN");

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
      },
      select: { id: true, schoolClassId: true },
    });

    /*
      The opt-ins, as rows against the school's own charges — see
      EnrollmentOption. A school whose catalogue has no bus or no cantine
      subscribes nobody to them, which is the honest outcome and the same one
      the app produces.

      Upserted on the (enrolment, fee type) unique, like everything else here,
      so a re-seed writes nothing.
    */
    const options: { feeTypeId: string; startsOn: Date | null }[] = [
      ...(usesTransport && transportCharge
        ? [{ feeTypeId: transportCharge.id, startsOn: null }]
        : []),
      ...(usesCanteen && canteenCharge
        ? [{ feeTypeId: canteenCharge.id, startsOn: canteenStartsOn }]
        : []),
    ];

    for (const option of options) {
      await db.enrollmentOption.upsert({
        where: {
          enrollmentId_feeTypeId: {
            enrollmentId: enrolment.id,
            feeTypeId: option.feeTypeId,
          },
        },
        update: {},
        create: { enrollmentId: enrolment.id, ...option },
      });
    }

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
      options,
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


// ── Adjustments to a schedule already written ────────────────────────────────

/**
 * The two things that happen to an échéancier after it is drawn up: a reduction
 * granted, and a charge struck off.
 *
 * Both are seeded because both have reports pointing at them — "réductions par
 * service" and the "journal des annulations" read nothing else — and a report
 * that can only ever be empty is one nobody can tell is working. Run *before*
 * any receipt is written: a payment settles `amountCentimes`, so reducing a line
 * after it has been paid would leave the family in credit.
 *
 * Idempotent. A line that already carries a reduction, or that has already been
 * struck off, is skipped rather than adjusted again — applying 20% twice is how
 * a seed quietly halves a school's turnover on the third run.
 */
export async function seedFeeAdjustments(
  db: SeedDb,
  {
    schoolId,
    schoolYearId,
    actorId,
  }: { schoolId: string; schoolYearId: string; actorId: string },
): Promise<void> {
  const sibling = await db.discount.findFirst({
    where: { schoolYearId, reason: "SIBLING", isActive: true },
    select: { id: true, kind: true, percentBps: true, amountCentimes: true },
  });

  let reduced = 0;

  if (sibling) {
    /*
      Réduction fratrie: the commonest reduction a Moroccan private school
      grants, and it goes to the *younger* children — the eldest pays full
      tuition. Ordered by birth date so "second child onwards" means the same
      thing on every run.
    */
    const families = await db.family.findMany({
      where: {
        schoolId,
        children: { some: { enrollments: { some: { schoolYearId } } } },
      },
      orderBy: { code: "asc" },
      select: {
        children: {
          orderBy: { birthDate: "asc" },
          select: {
            enrollments: {
              where: { schoolYearId },
              select: {
                fees: {
                  where: {
                    status: "DUE",
                    discountId: null,
                    discountBps: 0,
                    discountCentimes: 0,
                    feeType: { kind: "TUITION" },
                    // Never retro-discount a settled line: the receipt paid
                    // `amountCentimes`, and lowering it afterwards would leave
                    // the family in credit against a charge it has met.
                    allocations: { none: {} },
                  },
                  select: { id: true, baseAmountCentimes: true },
                },
              },
            },
          },
        },
      },
    });

    const discountBps =
      sibling.kind === "PERCENTAGE" ? (sibling.percentBps ?? 0) : 0;
    const discountCentimes =
      sibling.kind === "PERCENTAGE" ? 0 : (sibling.amountCentimes ?? 0);

    if (discountBps !== 0 || discountCentimes !== 0) {
      /*
        Collected by base amount, then written one `updateMany` per distinct
        base rather than one `update` per line. The net has to be computed from
        each line's own base — but two lines with the same base get the same
        net, and a school's price list has a dozen figures in it, not a
        thousand. Nine hundred round trips became nine.
      */
      const byBase = new Map<number, string[]>();
      for (const family of families) {
        const enrolled = family.children.filter(
          (child) => child.enrollments.length > 0,
        );
        if (enrolled.length < 2) continue;

        for (const child of enrolled.slice(1)) {
          for (const enrolment of child.enrollments) {
            for (const line of enrolment.fees) {
              byBase.set(line.baseAmountCentimes, [
                ...(byBase.get(line.baseAmountCentimes) ?? []),
                line.id,
              ]);
              reduced += 1;
            }
          }
        }
      }

      for (const [base, ids] of byBase) {
        await db.enrollmentFee.updateMany({
          where: { id: { in: ids } },
          data: {
            discountId: sibling.id,
            discountBps,
            discountCentimes,
            // Through the same helper an action would use, so the net can never
            // disagree with the base and the reduction beside it.
            amountCentimes: netAmount(base, discountBps, discountCentimes),
          },
        });
      }
    }
  }

  /*
    A handful of annulations. Optional charges a family declined after the
    schedule was written — a pupil who never took the bus, a club dropped at the
    rentrée — which is exactly what the status is for and what the journal
    reports. Struck off, never deleted: the trail is the point.
  */
  const optional = await db.enrollmentFee.findMany({
    where: {
      enrollment: { schoolYearId, student: { schoolId } },
      status: "DUE",
      cancelledAt: null,
      feeType: { kind: { in: ["TRANSPORT", "CANTEEN", "CLUB"] } },
      allocations: { none: {} },
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  /*
    Chosen by the line's own id, never by its position in this list.

    The query only returns lines still DUE, so a positional rule would pick a
    *different* set on every run — each one striking off another few per cent
    until the whole cantine had been cancelled. Keyed to the row, the second run
    finds the same lines already struck and nothing left to do.
  */
  const struck = optional.filter((line) => line.id.charCodeAt(4) % 23 === 0);
  for (const [index, line] of struck.entries()) {
    const waived = index % 3 === 0;
    await db.enrollmentFee.update({
      where: { id: line.id },
      data: {
        status: waived ? "WAIVED" : "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: waived
          ? "Geste commercial accordé par la direction"
          : "Service non retenu par la famille",
        cancelledById: actorId,
      },
    });
  }

  log(
    "ajustements",
    `${reduced} réductions fratrie, ${struck.length} annulations`,
  );
}
