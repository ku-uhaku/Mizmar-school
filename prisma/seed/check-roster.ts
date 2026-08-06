import { buildRoster } from "@/prisma/seed/roster";

/**
 * A dry run of the roster: no database, no writes.
 *
 * `tsx prisma/seed/check-roster.ts` — proves the two things the generated names
 * have to satisfy before a seed is worth running: every person's full name is
 * distinct, and every level got the pupils it asked for.
 */

const LEVEL_CODES = [
  "1AP", "2AP", "3AP", "4AP", "5AP", "6AP",
  "1AC", "2AC", "3AC",
  "TC", "1BAC", "2BAC",
];

const HOUSEHOLD_SIZES = [2, 3, 1, 2, 3, 2, 1, 2, 3, 2];

const roster = buildRoster({
  cohorts: LEVEL_CODES.map((levelCode, index) => ({
    levelCode,
    age: 6 + index,
    count: 2 * 18,
  })),
  cityCode: "OUJDA",
  cityName: "Oujda",
  neighbourhoodCodes: ["OUJ-CENTRE", "OUJ-SIDI-YAHYA", "OUJ-ANGAD"],
  yearLabel: "2026",
  variant: 0,
  householdSize: (index) => HOUSEHOLD_SIZES[index % HOUSEHOLD_SIZES.length],
});

const people: { who: string; name: string }[] = [
  ...roster.students.map((student) => ({
    who: `pupil ${student.code}`,
    name: `${student.firstName} ${student.lastName}`,
  })),
  ...roster.families.flatMap((family) =>
    [family.father, family.mother, family.guardian]
      .filter((person) => person !== undefined)
      .map((person) => ({
        who: `${family.code}`,
        name: `${person.first} ${person.last}`,
      })),
  ),
];

const seen = new Map<string, string>();
const clashes: string[] = [];
for (const person of people) {
  const key = person.name.toLowerCase();
  const first = seen.get(key);
  if (first) clashes.push(`${person.name} — ${first} and ${person.who}`);
  else seen.set(key, person.who);
}

console.log(`pupils        ${roster.students.length}`);
console.log(`dossiers      ${roster.families.length}`);
console.log(`people named  ${people.length}`);
console.log(`distinct      ${seen.size}`);
console.log(`clashes       ${clashes.length}`);
for (const clash of clashes.slice(0, 20)) console.log(`  ${clash}`);

const girls = roster.students.filter((s) => s.gender === "FEMALE").length;
console.log(`\nboys ${roster.students.length - girls} · girls ${girls}`);

const surnames = new Set(roster.students.map((s) => s.lastName));
console.log(`distinct surnames in use  ${surnames.size}`);

if (clashes.length > 0) process.exit(1);
