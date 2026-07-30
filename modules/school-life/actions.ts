"use server";

import { requireAuth } from "@/lib/dal";
import { PERMISSIONS } from "@/lib/permissions";
import { searchClasses } from "@/modules/classes/queries";
import { searchFamilies } from "@/modules/families/queries";
import { searchStudents } from "@/modules/students/queries";

/**
 * The header search.
 *
 * A Server Function rather than a route handler so it goes through the same
 * `requireAuth` every other write does, and so each module's own search stays
 * confined to the working context. Results are filtered by permission
 * *per kind*: a bursar with no access to family files gets pupils and classes
 * and nothing else, rather than an empty box or a forbidden error.
 */

export type SearchResults = {
  students: {
    id: string;
    label: string;
    detail: string;
    status: string;
  }[];
  families: { id: string; label: string; detail: string }[];
  classes: { id: string; label: string; detail: string }[];
};

const EMPTY: SearchResults = { students: [], families: [], classes: [] };

export async function globalSearchAction(
  term: string,
): Promise<SearchResults> {
  const context = await requireAuth();

  const trimmed = term.trim();
  // Two characters is where a name search stops matching half the school.
  if (trimmed.length < 2) return EMPTY;

  const [students, families, classes] = await Promise.all([
    context.can(PERMISSIONS.STUDENT_VIEW)
      ? searchStudents(context, trimmed)
      : [],
    context.can(PERMISSIONS.FAMILY_VIEW) ? searchFamilies(context, trimmed) : [],
    context.can(PERMISSIONS.CLASS_VIEW) ? searchClasses(context, trimmed) : [],
  ]);

  return {
    students: students.map((student) => ({
      id: student.id,
      label: `${student.firstName} ${student.lastName}`,
      detail: [student.code, student.className ?? student.levelName]
        .filter(Boolean)
        .join(" · "),
      status: student.status,
    })),
    families: families.map((family) => ({
      id: family.id,
      label: family.name,
      detail: [family.code, family.primaryContactPhone]
        .filter(Boolean)
        .join(" · "),
    })),
    classes: classes.map((schoolClass) => ({
      id: schoolClass.id,
      label: schoolClass.code,
      detail: `${schoolClass.levelLabel} · ${schoolClass.enrolled}`,
    })),
  };
}
