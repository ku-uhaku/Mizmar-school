import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { ImportConsole } from "@/modules/imports/components/import-console";

export const metadata: Metadata = { title: "Importer des élèves" };

/**
 * Import and export of the pupil list.
 *
 * The page gate is the *reading* permission, because the export half is a read
 * and a bursar who may see pupils may take the list away. Importing is gated
 * separately below and again inside the action, which is the check that counts —
 * a Server Function is reachable by direct POST whatever this page renders.
 */
export default async function ImportStudentsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.STUDENT_VIEW)) {
    return <ForbiddenState />;
  }

  const canImport =
    context.can(PERMISSIONS.IMPORT_STUDENTS) &&
    context.can(PERMISSIONS.STUDENT_CREATE) &&
    context.can(PERMISSIONS.FAMILY_CREATE);

  return (
    <>
      <PageHeader title={t.imports.title} description={t.imports.subtitle} />
      <ImportConsole canImport={canImport} />
    </>
  );
}
