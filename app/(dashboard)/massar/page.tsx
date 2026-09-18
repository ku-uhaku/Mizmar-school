import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { MassarConsole } from "@/modules/massar/components/massar-console";
import { RosterConsole } from "@/modules/massar/components/roster-console";
import { listMassarAssessmentTypes } from "@/modules/massar/queries";
import { listRosterClasses } from "@/modules/massar/roster-queries";

export const metadata: Metadata = { title: "Notes MASSAR" };

/**
 * The MASSAR round trip.
 *
 * Gated on `MASSAR_RECONCILE`, which is the read: checking a file against the
 * school writes nothing, and it is the question a secretary is asked. The three
 * directions that *do* write are gated separately below, and again inside each
 * action — which is the check that counts, since a Server Function is reachable
 * by direct POST whatever this page decides to render.
 */
export default async function MassarPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.MASSAR_RECONCILE)) {
    return <ForbiddenState />;
  }

  const assessmentTypes = await listMassarAssessmentTypes(context);
  const rosterClasses = await listRosterClasses(context);

  return (
    <>
      <PageHeader title={t.massar.title} description={t.massar.subtitle} />
      <MassarConsole
        assessmentTypes={assessmentTypes}
        // Importing writes marks onto a paper it may also have to create, so it
        // needs the marking permissions as well as the MASSAR one.
        canImport={
          context.can(PERMISSIONS.MASSAR_IMPORT) &&
          context.can(PERMISSIONS.ASSESSMENT_GRADE) &&
          context.can(PERMISSIONS.ASSESSMENT_MANAGE)
        }
        canExport={
          context.can(PERMISSIONS.MASSAR_EXPORT) && context.can(PERMISSIONS.ASSESSMENT_VIEW)
        }
        canMap={context.can(PERMISSIONS.MASSAR_MAP)}
      />
      <div className="mt-8">
        <PageHeader title={t.massar.roster.title} description={t.massar.roster.subtitle} />
        <RosterConsole
          classes={rosterClasses}
          // A class list opens pupils, dossiers and inscriptions in one go, so it
          // asks for the three creating permissions as well as the MASSAR one.
          canImport={
            context.can(PERMISSIONS.MASSAR_IMPORT) &&
            context.can(PERMISSIONS.STUDENT_CREATE) &&
            context.can(PERMISSIONS.FAMILY_CREATE) &&
            context.can(PERMISSIONS.ENROLMENT_CREATE)
          }
          canExport={context.can(PERMISSIONS.MASSAR_EXPORT) && context.can(PERMISSIONS.STUDENT_VIEW)}
        />
      </div>
    </>
  );
}
