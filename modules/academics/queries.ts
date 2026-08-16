import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { schoolScope } from "@/lib/scope";
import { bilingual } from "@/modules/academics/labels";

/**
 * Reads for the cursus.
 *
 * The module owns `Subject`, `Level` and `EducationLevel` but has never had a
 * `queries.ts`: it is edited under `/configuration`, whose generic resource
 * layer reads the tables through its own schema map. The hire form is the first
 * caller from another module, and a `db.subject.findMany` sitting in
 * `modules/hr` would be exactly the cross-module raw read the layering rules
 * forbid — so the pickers live here, with their owner.
 */

export type AcademicChoice = { id: string; label: string };

/**
 * The subjects a teacher may be declared for.
 *
 * Components are excluded (`parentId: null`). A school marks القراءة and
 * التعبير الكتابي separately on a primary bulletin, but nobody is *hired* to
 * teach a component — the qualification is for اللغة العربية, and offering all
 * three would turn a five-subject picker into a twenty-row one whose extra rows
 * nothing reads.
 */
export async function listSubjectChoices(
  context: AuthContext,
): Promise<AcademicChoice[]> {
  const subjects = await db.subject.findMany({
    where: { ...schoolScope(context), isActive: true, parentId: null },
    orderBy: [{ code: "asc" }],
    select: { id: true, code: true, name: true, nameAr: true },
  });

  return subjects.map((subject) => ({
    id: subject.id,
    label: bilingual(subject.name, subject.nameAr),
  }));
}

/**
 * The cycles the school runs — the widest scope a qualification is given.
 *
 * See the level-scope note on `TeacherSubject`: naming a cycle is what stops a
 * primaire teacher being offered to a baccalauréat class, and it is the scope a
 * school can actually state at the moment somebody is hired. The narrower
 * per-niveau list is declared afterwards, under Configuration.
 */
export async function listCycleChoices(
  context: AuthContext,
): Promise<AcademicChoice[]> {
  const cycles = await db.educationLevel.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, nameAr: true },
  });

  return cycles.map((cycle) => ({
    id: cycle.id,
    label: bilingual(cycle.name, cycle.nameAr),
  }));
}
