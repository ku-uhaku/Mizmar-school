import { db } from "@/prisma/seed/client";

/**
 * What is actually in the database — `tsx prisma/seed/counts.ts`.
 *
 * The seed is upserted and never deletes, so the honest way to prove a change
 * to it is counts before and a re-run after: the second run of the same seed
 * must move none of these numbers.
 */
async function main() {
  const years = await db.schoolYear.findMany({
    select: { name: true, startDate: true, endDate: true, status: true },
    orderBy: { name: "asc" },
  });

  for (const year of years) {
    console.log(
      `${year.name}  ${year.startDate.toISOString().slice(0, 10)} → ` +
        `${year.endDate.toISOString().slice(0, 10)}  ${year.status}`,
    );
  }

  const terms = await db.term.findMany({
    select: { name: true, startDate: true, endDate: true, status: true },
    orderBy: { number: "asc" },
  });
  for (const term of terms) {
    console.log(
      `  ${term.name}  ${term.startDate.toISOString().slice(0, 10)} → ` +
        `${term.endDate.toISOString().slice(0, 10)}  ${term.status}`,
    );
  }

  console.log({
    schools: await db.school.count(),
    classes: await db.schoolClass.count(),
    students: await db.student.count(),
    families: await db.family.count(),
    guardians: await db.guardian.count(),
    enrolments: await db.enrollment.count(),
    staff: await db.staff.count(),
    users: await db.user.count(),
    timetableEntries: await db.timetableEntry.count(),
    assessments: await db.assessment.count(),
    grades: await db.assessmentGrade.count(),
    attendance: await db.studentAttendance.count(),
    payments: await db.payment.count(),
    subscriptions: await db.transportSubscription.count(),
    schoolWeeks: await db.schoolWeek.count(),
  });
}

void main().finally(() => db.$disconnect());
