import type { FamilySeed } from "@/modules/families/seed";
import type { StudentSeed } from "@/modules/students/seed";
import {
  BOYS,
  FATHERS,
  GIRLS,
  MOTHERS,
  PROFESSIONS,
  STREETS,
  SURNAMES,
  pick,
  pickUnique,
  spread,
} from "@/prisma/seed/names";

/**
 * One school's dossiers and the children on them, built rather than listed.
 *
 * A thousand pupils cannot be typed out, and a class list of six is not a demo
 * of anything — the data table, the class roster, the mark sheet and the fee
 * grid all behave differently at twenty-one pupils than at three. So the roster
 * is generated from the name pools in `names.ts`, to an exact shape: so many
 * pupils at each level, no more and no fewer.
 *
 * ── Everything here is a function of an index ───────────────────────────────
 * No randomness at all. The seed is upserted on the matricule, so a roster that
 * re-rolled its choices would quietly rewrite E-2025-0417 as a different child
 * on every run — the name would change, the age would change, and the enrolment
 * seeded against it would stop meaning what it said. Index arithmetic gives the
 * same roster every time, which is the whole contract of an idempotent seed.
 *
 * ── Siblings ────────────────────────────────────────────────────────────────
 * Children are grouped onto one dossier a few at a time — two by default, or
 * however many `householdSize` returns for a school that wants a different
 * mix — and the pupil list is built by rotating through the levels rather than
 * filling one level at a time, so the children of a household land in
 * different levels. That is what makes the sibling reduction demonstrable and
 * the family screen worth opening — a database where every family has one only
 * child cannot show either.
 */

export type Cohort = {
  /** What the school calls the level — only used to make the roster readable. */
  levelCode: string;
  /** Age at the start of the year, which is what places the child. */
  age: number;
  /** Pupils to produce at this level. */
  count: number;
};

export type Roster = {
  families: FamilySeed[];
  students: StudentSeed[];
};

/**
 * `+212 522 45 67 90` — nine digits after the country code, which is what a
 * Moroccan number is. Landlines start 5, mobiles 6.
 */
function phone(kind: "fixed" | "mobile", index: number): string {
  const pairs = (seed: number) =>
    [0, 1, 2]
      .map((step) => String((seed * (7 + step * 3) + step * 17) % 100).padStart(2, "0"))
      .join(" ");

  return kind === "fixed"
    ? `+212 5${String(22 + (index % 15)).padStart(2, "0")} ${pairs(index + 3)}`
    : `+212 6${String(60 + (index % 10))} ${pairs(index + 11)}`;
}

/**
 * A household's situation.
 *
 * Mostly married, with roughly a ninth divorced and a seventeenth widowed —
 * enough of each that the screens which branch on it (who receives the
 * paperwork, who may collect a child) are exercised by the demo data instead of
 * only ever seeing the common case.
 */
function situationFor(index: number): string {
  const scattered = spread(index);
  if (scattered % 17 === 5) return "WIDOWED";
  if (scattered % 9 === 4) return "DIVORCED";
  return "MARRIED";
}

/**
 * Assigns each pupil slot to a household, `householdSize(familyIndex)` at a
 * time.
 *
 * A generator rather than a fixed array so the default — a constant two — needs
 * no caller to know about it, and a school after a different mix (a rounder
 * family count against a fixed pupil count, say) supplies one function and
 * nothing else changes. The odd slots left after the last full household simply
 * get a smaller one, which is the ordinary case `Math.floor` used to handle on
 * its own.
 */
function assignFamilies(
  totalSlots: number,
  householdSize: (familyIndex: number) => number,
): number[] {
  const assignment: number[] = [];
  let familyIndex = 0;
  while (assignment.length < totalSlots) {
    const size = Math.max(1, householdSize(familyIndex));
    for (let taken = 0; taken < size && assignment.length < totalSlots; taken += 1) {
      assignment.push(familyIndex);
    }
    familyIndex += 1;
  }
  return assignment;
}

export function buildRoster({
  cohorts,
  cityCode,
  cityName,
  neighbourhoodCodes,
  yearLabel,
  /** Offsets the name pools so the two schools do not produce the same roster. */
  variant,
  /** Children per dossier, by household index. Two apiece unless told otherwise. */
  householdSize = () => 2,
}: {
  cohorts: Cohort[];
  /** `City.code` the children are born in — see modules/geography/seed.ts. */
  cityCode: string;
  /** The town on the dossier's address. */
  cityName: string;
  /**
   * The quartiers of that town, by `Neighbourhood.code`. Households are spread
   * across them, which is what lets a bus line be drawn against a quartier.
   */
  neighbourhoodCodes: string[];
  /** Prefix year for the matricules and dossier numbers, e.g. "2025". */
  yearLabel: string;
  variant: number;
  householdSize?: (familyIndex: number) => number;
}): Roster {
  /*
    The pupils to produce, level by level, interleaved.

    Rotating through the cohorts rather than draining one at a time is what puts
    the children of a dossier in different levels — households are grouped from
    this list in order below, and a level-major order would make every sibling
    group land in one level instead of spreading across them.
  */
  const slots: { levelCode: string; age: number }[] = [];
  const remaining = cohorts.map((cohort) => cohort.count);
  let left = remaining.reduce((sum, count) => sum + count, 0);

  while (left > 0) {
    for (const [index, cohort] of cohorts.entries()) {
      if (remaining[index] === 0) continue;
      slots.push({ levelCode: cohort.levelCode, age: cohort.age });
      remaining[index] -= 1;
      left -= 1;
    }
  }

  const familyIndexForSlot = assignFamilies(slots.length, householdSize);

  const families: FamilySeed[] = [];
  const students: StudentSeed[] = [];

  /*
    Every full name this school hands out, pupils and guardians together.

    One set rather than one per group, because the duplicate that matters is not
    "two pupils" — it is two *people*: a father and a son on the same dossier
    called Youssef Bennani is the reading a family screen must never produce.
    See `pickUnique`, which walks the pool forward from where the hash landed
    until it finds a combination this set has not seen.
  */
  const takenNames = new Set<string>();

  for (const [index, slot] of slots.entries()) {
    const familyIndex = familyIndexForSlot[index];
    const surname = pick(SURNAMES, spread(familyIndex + variant * 977));
    const familyCode = `F-${yearLabel}-${String(familyIndex + 1).padStart(4, "0")}`;

    if (families.length === familyIndex) {
      const situation = situationFor(familyIndex + variant);
      // Built only when the dossier has one: a widowed file keeps a single
      // parent, and claiming a name for a father who is not recorded would
      // spend it on nobody. `ensurePrimaryContact` promotes the mother.
      const father =
        situation === "WIDOWED"
          ? undefined
          : {
              first: pickUnique(
                FATHERS,
                spread(familyIndex + variant * 31),
                surname.fr,
                takenNames,
                (name) => name,
              ),
              last: surname.fr,
              profession: pick(PROFESSIONS, spread(familyIndex * 2 + variant)),
              phone: phone("mobile", familyIndex * 2),
            };
      const mother = {
        first: pickUnique(
          MOTHERS,
          spread(familyIndex + variant * 53),
          surname.fr,
          takenNames,
          (name) => name,
        ),
        last: surname.fr,
        profession: pick(PROFESSIONS, spread(familyIndex * 2 + 1 + variant)),
        phone: phone("mobile", familyIndex * 2 + 1),
      };

      families.push({
        code: familyCode,
        name: `Famille ${surname.fr}`,
        nameAr: `أسرة ${surname.ar}`,
        situation,
        city: cityName,
        addressLine: `${(spread(familyIndex) % 180) + 1}, ${pick(STREETS, spread(familyIndex + variant * 7))}`,
        phone: phone("fixed", familyIndex),
        father,
        mother,
        // A divorced file gets a tuteur as well — several contacts on one
        // dossier is the case the guardian screen exists for. Their own
        // surname, since a tuteur is rarely of the household's family.
        guardian:
          situation === "DIVORCED"
            ? (() => {
                const guardianSurname = pick(
                  SURNAMES,
                  spread(familyIndex + 13),
                ).fr;
                return {
                  first: pickUnique(
                    FATHERS,
                    spread(familyIndex + 6),
                    guardianSurname,
                    takenNames,
                    (name) => name,
                  ),
                  last: guardianSurname,
                  profession: pick(PROFESSIONS, spread(familyIndex + 4)),
                  phone: phone("mobile", familyIndex * 2 + 500),
                };
              })()
            : undefined,
      });
    }

    // Scattered rather than alternated: the pupils of one class sit a fixed
    // stride apart in this list, so `index % 2` gave every class a single sex.
    const isBoy = spread(index + variant * 101) % 2 === 0;
    const given = pickUnique(
      isBoy ? BOYS : GIRLS,
      spread(index * 3 + variant * 211),
      surname.fr,
      takenNames,
      (name) => name.fr,
    );

    students.push({
      code: `E-${yearLabel}-${String(index + 1).padStart(4, "0")}`,
      familyCode,
      firstName: given.fr,
      lastName: surname.fr,
      firstNameAr: given.ar,
      lastNameAr: surname.ar,
      gender: isBoy ? "MALE" : "FEMALE",
      age: slot.age,
      birthCityCode: cityCode,
      // By household, not by child: siblings live at the same address, and a
      // family split across two bus lines is a bug the report would expose.
      neighbourhoodCode:
        neighbourhoodCodes.length > 0
          ? neighbourhoodCodes[spread(familyIndex + variant * 37) % neighbourhoodCodes.length]
          : "",
      /*
        A Massar number as the ministry issues them: the AREF letter, then the
        province and a serial. Made up, but the right shape — the official lists
        are checked against it column by column, and a blank one is untestable.
      */
      massarCode: `${variant === 0 ? "J" : "R"}${String(130_000_000 + index + variant * 500_000)}`,
    });
  }

  return { families, students };
}
