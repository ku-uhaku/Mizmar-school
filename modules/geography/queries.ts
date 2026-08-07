import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentSchoolId } from "@/lib/scope";

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
      schoolId: currentSchoolId(context),
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
 * A quartier to pick from, and the town it sits in.
 *
 * The town rides alongside the label rather than only inside it so a dropdown
 * can group by it — see `listNeighbourhoodChoices`.
 */
export type NeighbourhoodOption = CityChoice & {
  cityId: string;
  cityName: string;
};

/**
 * Quartiers to pick from, labelled with their town and ordered by it.
 *
 * ── Why the town is on the choice and not just in the label ──────────────────
 * The label has always carried it, because two towns can each have a
 * "Centre-ville" and a bare list of quartier names makes those two rows
 * indistinguishable at the moment of choosing. What the label could not do is
 * keep them apart in a long list: a school serving more than one town gave a
 * secretary one flat run of names to scroll, with the five that applied to the
 * child in front of them somewhere in the middle.
 *
 * Grouped rather than filtered, and that is deliberate. There is no *residence*
 * town on a pupil to filter by — `Student.birthCityId` is where the child was
 * born, and narrowing the address list by it would hide the right quartier for
 * every child born somewhere other than where they live, which is most of them
 * in a town like Oujda. The quartier *is* the address; its town is derived from
 * it. So the list groups under its towns and stays complete.
 */
export async function listNeighbourhoodChoices(
  context: AuthContext,
  include: (string | null)[] = [],
): Promise<NeighbourhoodOption[]> {
  const kept = include.filter((id): id is string => Boolean(id));

  const neighbourhoods = await db.neighbourhood.findMany({
    where: {
      schoolId: currentSchoolId(context),
      ...(kept.length > 0
        ? { OR: [{ isActive: true }, { id: { in: kept } }] }
        : { isActive: true }),
    },
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      city: { select: { id: true, name: true } },
    },
  });

  return neighbourhoods.map((neighbourhood) => ({
    id: neighbourhood.id,
    label: `${neighbourhood.city.name} · ${neighbourhood.name}`,
    cityId: neighbourhood.city.id,
    cityName: neighbourhood.city.name,
  }));
}
