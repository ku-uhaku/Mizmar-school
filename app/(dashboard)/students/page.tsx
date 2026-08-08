import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { StudentsManager } from "@/modules/students/components/students-manager";
import {
  isStudentSort,
  listStudentFacetOptions,
  listStudentsPage,
} from "@/modules/students/queries";

export const metadata: Metadata = { title: "Élèves" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();
  const params = await searchParams;

  if (!context.can(PERMISSIONS.STUDENT_VIEW)) {
    return <ForbiddenState />;
  }

  const single = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };

  /** The multi-select facets travel as one comma-joined parameter each. */
  const list = (key: string): string[] | undefined => {
    const value = single(key);
    if (!value) return undefined;
    const values = value.split(",").filter(Boolean);
    return values.length > 0 ? values : undefined;
  };

  const sort = single("sort");

  // Scoped to the school in context; placement comes from the year in context.
  // The window, the filters and the order are all decided in the query — see
  // the note on `listStudentsPage`.
  const [page, facetOptions] = await Promise.all([
    listStudentsPage(context, {
      search: single("q"),
      statuses: list("status"),
      genders: list("gender"),
      levels: list("level"),
      classes: list("class"),
      // An unknown sort is a stale link or a hand-edited query string, and
      // falling back to the default beats refusing to render the list.
      sort: isStudentSort(sort) ? sort : undefined,
      page: Number(single("page") ?? 1) || 1,
    }),
    listStudentFacetOptions(context),
  ]);

  return (
    <>
      <PageHeader title={t.student.title} description={t.student.subtitle} />

      <StudentsManager
        page={page}
        facetOptions={facetOptions}
        permissions={{
          canCreate: context.can(PERMISSIONS.STUDENT_CREATE),
          canUpdate: context.can(PERMISSIONS.STUDENT_UPDATE),
          canDelete: context.can(PERMISSIONS.STUDENT_DELETE),
        }}
      />
    </>
  );
}
