import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { RemarksReview } from "@/modules/classroom/components/remarks-review";
import {
  listRemarkFilterChoices,
  listRemarks,
} from "@/modules/classroom/queries";

export const metadata: Metadata = { title: "Remarques" };

/**
 * Les remarques, seen from the direction.
 *
 * Thin, as every page is: authorize, call the module's queries, render. The
 * filters arrive as query parameters and go straight into the read — see
 * `RemarksReview` on why they are not applied in the browser.
 *
 * Gated on `classroom.remarkPublish` rather than the view code. This is the
 * screen where a teacher's observation is released to a family, and a reader
 * who cannot make that decision is better served by the carnet or by the
 * pupil's own file — both of which show remarks in the context they belong to.
 */
export default async function SchoolLifeRemarksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH)) {
    return <ForbiddenState />;
  }

  const params = await searchParams;
  const one = (key: string): string => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  const filters = {
    search: one("q"),
    authorId: one("teacher"),
    schoolClassId: one("class"),
    tone: one("tone"),
    kind: one("kind"),
    pendingOnly: one("pending") === "1",
  };

  const [remarks, choices] = await Promise.all([
    listRemarks(context, {
      search: filters.search || undefined,
      authorId: filters.authorId || undefined,
      schoolClassId: filters.schoolClassId || undefined,
      tone: filters.tone || undefined,
      kind: filters.kind || undefined,
      pendingOnly: filters.pendingOnly || undefined,
    }),
    listRemarkFilterChoices(context),
  ]);

  return (
    <>
      <PageHeader
        title={t.classroom.remarksReview}
        description={t.classroom.remarksReviewHint}
      />

      <RemarksReview
        remarks={remarks}
        choices={choices}
        filters={filters}
        canPublish
      />
    </>
  );
}
