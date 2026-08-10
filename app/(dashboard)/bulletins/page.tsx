import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listAssessableClasses, listTerms } from "@/modules/assessments/queries";
import { BulletinsManager } from "@/modules/bulletins/components/bulletins-manager";
import { loadClassCouncil } from "@/modules/bulletins/queries";

export const metadata: Metadata = { title: "Bulletins" };

/**
 * Le conseil de classe, for one class and one term.
 *
 * The pair travels in the query string for the same reason it does on the
 * contrôles screen: a reload, or a link sent to somebody sitting in the same
 * meeting, has to land on the same table. Both ids are only ever hints — the
 * queries scope them to the school and year in context, so one from elsewhere
 * matches nothing.
 *
 * The classes and the terms are the assessments module's own reads. A bulletin
 * is filed against exactly the class and term a contrôle is, so re-deriving the
 * lists here would be a second answer to a question that module already
 * answers — and the two pickers would eventually disagree.
 */
export default async function BulletinsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.BULLETIN_VIEW)) {
    return <ForbiddenState />;
  }

  const params = await searchParams;

  const [classes, terms] = await Promise.all([
    listAssessableClasses(context),
    listTerms(context),
  ]);

  // Default to the first class and the term actually running, which is what
  // somebody opening this screen in the week of a council is looking for.
  const selectedClass =
    classes.find((option) => option.id === params.class) ?? classes[0] ?? null;
  const selectedTerm =
    terms.find((term) => term.id === params.term) ??
    terms.find((term) => term.status === "ACTIVE") ??
    terms[0] ??
    null;

  const council =
    selectedClass && selectedTerm
      ? await loadClassCouncil(context, selectedClass.id, selectedTerm.id)
      : null;

  return (
    <>
      <PageHeader title={t.bulletin.title} description={t.bulletin.subtitle} />

      <BulletinsManager
        council={council}
        classes={classes}
        terms={terms}
        classId={selectedClass?.id ?? null}
        termId={selectedTerm?.id ?? null}
        permissions={{
          canCompute: context.can(PERMISSIONS.BULLETIN_COMPUTE),
          canAppreciate: context.can(PERMISSIONS.BULLETIN_APPRECIATE),
          canCouncil: context.can(PERMISSIONS.BULLETIN_COUNCIL),
          canPublish: context.can(PERMISSIONS.BULLETIN_PUBLISH),
        }}
      />
    </>
  );
}
