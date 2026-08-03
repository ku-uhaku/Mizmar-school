"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { toCsv } from "@/lib/csv";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { withActionErrors } from "@/lib/server-action";
import { exportStudentRows } from "@/modules/imports/queries";
import { commitImport, planImport, type ImportPlan } from "@/modules/imports/service";

/**
 * Entry points for bulk loading.
 *
 * ── Why the file travels twice ───────────────────────────────────────────────
 * The preview and the commit each receive the file text and each re-derive the
 * plan on the server. Sending the *plan* back for the commit would be handing an
 * attacker the verdict — which rows to create, which school to create them in —
 * and every check in `planImport` would then be advisory. The browser holds the
 * file it already read; sending it again costs a second parse and nothing else.
 */

/** The most a single upload may weigh, before it is even parsed. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Asserts the caller may bulk-load into the school in context.
 *
 * Three codes, not one. `IMPORT_STUDENTS` is the permission to do this *in
 * bulk*; the other two are the permissions to create the rows at all, and
 * without them this action would be a way around both forms.
 */
async function authorizeImport() {
  const t = await getDictionary();
  const base = await requireAuth();
  const schoolId = base.currentSchool?.id;
  if (!schoolId) return { ok: false as const, t, state: failure(t.errors.noSchoolContext) };

  const context = await authorizeSchool(schoolId, PERMISSIONS.IMPORT_STUDENTS);
  await authorizeSchool(schoolId, PERMISSIONS.STUDENT_CREATE);
  await authorizeSchool(schoolId, PERMISSIONS.FAMILY_CREATE);

  return { ok: true as const, t, context, schoolId };
}

export type PreviewResult =
  | { status: "ok"; plan: ImportPlan }
  | { status: "error"; message: string };

/** Reads the file and reports what would happen. Writes nothing. */
export async function previewImportAction(
  csvText: string,
): Promise<PreviewResult> {
  const t = await getDictionary();

  if (typeof csvText !== "string" || csvText.trim() === "") {
    return { status: "error", message: t.imports.errors.emptyFile };
  }
  if (csvText.length > MAX_UPLOAD_BYTES) {
    return { status: "error", message: t.imports.errors.fileTooLarge };
  }

  const auth = await authorizeImport();
  if (!auth.ok) return { status: "error", message: auth.state.message ?? "" };

  const plan = await planImport(auth.context, csvText, t);
  return { status: "ok", plan };
}

/**
 * Writes the file.
 *
 * Re-plans from the text rather than trusting anything the preview produced, so
 * a row the browser was told would be skipped is skipped here for the same
 * reason rather than because it was labelled that way.
 */
export async function runImportAction(csvText: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    if (typeof csvText !== "string" || csvText.trim() === "") {
      return failure(t.imports.errors.emptyFile);
    }
    if (csvText.length > MAX_UPLOAD_BYTES) {
      return failure(t.imports.errors.fileTooLarge);
    }

    const auth = await authorizeImport();
    if (!auth.ok) return auth.state;

    const result = await commitImport(auth.context, csvText, t);
    if (result.created === 0) return failure(t.imports.errors.nothingToImport);

    refresh();
    // Two sentences, because "and their échéancier exists" is the half a bursar
    // needs and the half that is invisible from the pupils list.
    return success(
      result.enrolled > 0
        ? interpolate(t.imports.enrolled, {
            count: result.created,
            families: result.families,
            enrolled: result.enrolled,
          })
        : interpolate(t.imports.imported, {
            count: result.created,
            families: result.families,
          }),
    );
  });
}

/**
 * The school's pupils, as a file.
 *
 * Returns the text rather than streaming a response: the download is triggered
 * in the browser from a Blob, which is what lets it carry the BOM Excel needs
 * and a filename the school can recognise a month later.
 */
export async function exportStudentsAction(): Promise<
  { status: "ok"; csv: string; filename: string } | { status: "error"; message: string }
> {
  const t = await getDictionary();
  const context = await requireAuth();
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return { status: "error", message: t.errors.noSchoolContext };

  // Reading pupils and their dossiers — the permissions the two lists already
  // carry. Exporting is not a third thing a role can be granted separately.
  await authorizeSchool(schoolId, PERMISSIONS.STUDENT_VIEW);
  await authorizeSchool(schoolId, PERMISSIONS.FAMILY_VIEW);

  const rows = await exportStudentRows(context, t);
  const stamp = new Date().toISOString().slice(0, 10);

  return {
    status: "ok",
    csv: toCsv(rows),
    filename: `eleves-${stamp}.csv`,
  };
}
