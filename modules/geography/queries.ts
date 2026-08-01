import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";

/**
 * Reads for the geography module.
 *
 * One function, because there is one question: which towns may this screen
 * offer? Scoped to `context.currentSchool` like every other list — a school
 * picks from its own list, and switching school in the header changes it.
 */

export type CityChoice = { id: string; label: string };

/**
 * Towns to pick from, active ones only, plus whichever is already on the row
 * being edited.
 *
 * `include` is what keeps a deactivated town from silently vanishing off a
 * pupil's file: merging two spellings deactivates the loser, and a form that
 * dropped it would blank the birthplace of everyone born there the next time
 * somebody pressed Save.
 */
export async function listCityChoices(
  context: AuthContext,
  include: (string | null)[] = [],
): Promise<CityChoice[]> {
  const kept = include.filter((id): id is string => Boolean(id));

  const cities = await db.city.findMany({
    where: {
      schoolId: context.currentSchool?.id ?? "__none__",
      ...(kept.length > 0
        ? { OR: [{ isActive: true }, { id: { in: kept } }] }
        : { isActive: true }),
    },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, nameAr: true },
  });

  // Both spellings in the label, so a secretary working in French and a
  // director reading the Arabic paperwork recognise the same row.
  return cities.map((city) => ({
    id: city.id,
    label: city.nameAr ? `${city.name} — ${city.nameAr}` : city.name,
  }));
}

/**
 * Quartiers to pick from, labelled with their town.
 *
 * The town is in the label rather than in a grouped dropdown because two towns
 * can each have a "Centre-ville", and a bare list of quartier names makes those
 * two rows indistinguishable at the moment of choosing.
 */
export async function listNeighbourhoodChoices(
  context: AuthContext,
  include: (string | null)[] = [],
): Promise<CityChoice[]> {
  const kept = include.filter((id): id is string => Boolean(id));

  const neighbourhoods = await db.neighbourhood.findMany({
    where: {
      schoolId: context.currentSchool?.id ?? "__none__",
      ...(kept.length > 0
        ? { OR: [{ isActive: true }, { id: { in: kept } }] }
        : { isActive: true }),
    },
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, city: { select: { name: true } } },
  });

  return neighbourhoods.map((neighbourhood) => ({
    id: neighbourhood.id,
    label: `${neighbourhood.city.name} · ${neighbourhood.name}`,
  }));
}
