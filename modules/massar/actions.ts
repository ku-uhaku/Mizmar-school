"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth, type AuthContext } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { withActionErrors } from "@/lib/server-action";
import type { Dictionary } from "@/lib/i18n/types";
import {
  reconcileNotesFile,
  toMassarPreview,
  type MassarFileRead,
  type MassarPreview,
  type MassarReconciliation,
} from "@/modules/massar/queries";
import {
  adoptFromFile,
  exportNotes,
  generateControle,
  importNotes,
  type MassarWriteResult,
} from "@/modules/massar/service";

/**
 * Entry points for the MASSAR round trip.
 *
 * ── The workbook travels with every call ────────────────────────────────────
 * Each action receives the file again and reconciles it again. Sending back the
 * *report* — "these twenty-six rows matched, write them" — would make every
 * check in `runChecks` advisory: a crafted post could claim a clean match
 * against another school's class and the writers would believe it. Re-reading
 * 30 KB of XML is the cheapest possible price for the guarantee that nothing is
 * ever written on the browser's say-so.
 *
 * The file arrives base64-encoded. A workbook is binary and a Server Action
 * argument is JSON; the third of a byte this wastes is not worth a second
 * upload endpoint that would need its own authorization.
 */

/** The most a mark sheet may weigh. A NotesCC export is about 30 KB. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function decode(base64: string): Buffer | null {
  if (typeof base64 !== "string" || base64 === "") return null;
  // Base64 is 4 characters per 3 bytes — checked before decoding so an
  // oversized upload is refused without being materialised first.
  if ((base64.length * 3) / 4 > MAX_UPLOAD_BYTES) return null;
  const buffer = Buffer.from(base64, "base64");
  return buffer.length === 0 ? null : buffer;
}

/** The message for a workbook that is not a MASSAR mark sheet at all. */
function shapeMessage(t: Dictionary, error: MassarFileRead): string {
  if (error.ok) return "";
  switch (error.reason) {
    case "NOT_XLSX":
      return t.massar.errors.notXlsx;
    case "NO_SHEET":
      return t.massar.errors.noSheet;
    case "NO_MARKERS":
      return t.massar.errors.noMarkers;
    case "NO_PUPILS":
      return t.massar.errors.noPupils;
  }
}

type Prepared =
  | { ok: true; t: Dictionary; context: AuthContext; reconciliation: MassarReconciliation }
  | { ok: false; t: Dictionary; message: string };

/**
 * Authorize, decode, reconcile — the four lines every action below starts with.
 *
 * The permission is asserted *before* the file is parsed, so an unauthorised
 * caller cannot use parser behaviour to learn anything about the school.
 */
async function prepare(
  base64: string,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  assessmentTypeId?: string | null,
): Promise<Prepared> {
  const t = await getDictionary();
  const base = await requireAuth();

  const schoolId = base.currentSchool?.id;
  if (!schoolId) return { ok: false, t, message: t.errors.noSchoolContext };

  const context = await authorizeSchool(schoolId, permission);

  const buffer = decode(base64);
  if (!buffer) return { ok: false, t, message: t.massar.errors.emptyFile };

  const result = await reconcileNotesFile(context, buffer, { assessmentTypeId });
  if ("error" in result) return { ok: false, t, message: shapeMessage(t, result.error) };

  return { ok: true, t, context, reconciliation: result };
}

/** Turns a refusal from the service into the sentence explaining it. */
function writeFailure(t: Dictionary, result: Extract<MassarWriteResult, { ok: false }>): ActionState {
  switch (result.reason) {
    case "blocked":
      return failure(t.massar.errors.blocked);
    case "no-rows":
      return failure(t.massar.errors.noRows);
    case "no-type":
      return failure(t.massar.errors.noType);
    case "locked":
      return failure(t.massar.errors.locked);
    case "out-of-range":
      return failure(t.massar.errors.outOfRange);
    case "not-found":
      return failure(t.massar.errors.assessmentNotFound);
  }
}

export type ReconcileResult =
  | { status: "ok"; preview: MassarPreview }
  | { status: "error"; message: string };

/**
 * Read the file and report every check. Writes nothing.
 *
 * This is the screen the school looks at, and on a file that fails it is the
 * whole product: the named check, what was expected, what the cell held.
 */
export async function reconcileMassarAction(
  fileBase64: string,
  assessmentTypeId?: string | null,
): Promise<ReconcileResult> {
  const prepared = await prepare(fileBase64, PERMISSIONS.MASSAR_RECONCILE, assessmentTypeId);
  if (!prepared.ok) return { status: "error", message: prepared.message };
  return { status: "ok", preview: toMassarPreview(prepared.reconciliation) };
}

/**
 * Create the contrôle this sheet is about, and stamp MASSAR's id on it.
 *
 * `ASSESSMENT_MANAGE` as well as the MASSAR code: setting a paper is a head of
 * studies' decision wherever it comes from, and arriving with a spreadsheet must
 * not be a way around that.
 */
export async function generateControleAction(
  fileBase64: string,
  assessmentTypeId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const prepared = await prepare(fileBase64, PERMISSIONS.MASSAR_IMPORT, assessmentTypeId);
    if (!prepared.ok) return failure(prepared.message);
    const { t, context, reconciliation } = prepared;

    await authorizeSchool(context.currentSchool!.id, PERMISSIONS.ASSESSMENT_MANAGE);

    const result = await generateControle(context, reconciliation, assessmentTypeId);
    if (!result.ok) return writeFailure(t, result);

    refresh();
    return success(
      result.count === 0 ? t.massar.controleExisted : t.massar.controleCreated,
    );
  });
}

/**
 * Excel → the database. The direction a school runs after a marking session in
 * MASSAR.
 *
 * The contrôle is created if it is not there yet, because "import these marks"
 * and "onto a paper that does not exist" is not a question worth asking a
 * secretary — it is the same decision, and splitting it into two buttons only
 * means the second one gets forgotten.
 */
export async function importNotesAction(
  fileBase64: string,
  assessmentTypeId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const prepared = await prepare(fileBase64, PERMISSIONS.MASSAR_IMPORT, assessmentTypeId);
    if (!prepared.ok) return failure(prepared.message);
    const { t, context, reconciliation } = prepared;

    // Entering marks in bulk still requires the permission to enter one.
    await authorizeSchool(context.currentSchool!.id, PERMISSIONS.ASSESSMENT_GRADE);
    await authorizeSchool(context.currentSchool!.id, PERMISSIONS.ASSESSMENT_MANAGE);

    const paper = await generateControle(context, reconciliation, assessmentTypeId);
    if (!paper.ok) return writeFailure(t, paper);

    const result = await importNotes(context, reconciliation, paper.assessmentId);
    if (!result.ok) return writeFailure(t, result);

    refresh();
    return success(
      interpolate(t.massar.imported, {
        count: result.count,
        rejected: reconciliation.report.rejectedLines.length,
      }),
    );
  });
}

export type ExportResult =
  | { status: "ok"; fileBase64: string; filename: string; count: number }
  | { status: "error"; message: string };

/**
 * The database → Excel: the uploaded workbook back, with our marks written into
 * it, ready to go up to MASSAR.
 *
 * Returned as base64 for the browser to save from a Blob, like the pupil export:
 * a Server Action cannot set a Content-Disposition, and routing this through an
 * API route would mean a second authorization path for the same bytes.
 */
export async function exportNotesAction(
  fileBase64: string,
  assessmentTypeId: string,
): Promise<ExportResult> {
  const prepared = await prepare(fileBase64, PERMISSIONS.MASSAR_EXPORT, assessmentTypeId);
  if (!prepared.ok) return { status: "error", message: prepared.message };
  const { t, context, reconciliation } = prepared;

  await authorizeSchool(context.currentSchool!.id, PERMISSIONS.ASSESSMENT_VIEW);

  const assessmentId = reconciliation.db.assessment?.id ?? null;
  if (assessmentId === null) {
    return { status: "error", message: t.massar.errors.assessmentNotFound };
  }

  const buffer = decode(fileBase64);
  if (!buffer) return { status: "error", message: t.massar.errors.emptyFile };

  const result = await exportNotes(context, reconciliation, buffer, assessmentId);
  if (!result.ok) {
    return {
      status: "error",
      message: result.reason === "blocked" ? t.massar.errors.blocked : t.massar.errors.assessmentNotFound,
    };
  }

  const label = reconciliation.file.classLabel ?? reconciliation.db.schoolClass?.code ?? "notes";
  return {
    status: "ok",
    fileBase64: result.file.toString("base64"),
    // Named after the class and the contrôle, because a school ends up with a
    // folder of these and "147610 (3).xlsx" tells nobody anything.
    filename: `NotesCC-${label}-S${reconciliation.file.termNumber ?? "?"}-C${reconciliation.file.sequence ?? "?"}.xlsx`,
    count: result.count,
  };
}

/**
 * Clone the file's identity into the school: MASSAR's codes onto the class, the
 * subject, the term and the pupils that had none.
 *
 * `MASSAR_MAP` and nothing else — this writes no marks. It is the step that
 * makes every later sheet match on codes instead of on names.
 */
export async function adoptMappingsAction(
  fileBase64: string,
  assessmentTypeId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const prepared = await prepare(fileBase64, PERMISSIONS.MASSAR_MAP, assessmentTypeId);
    if (!prepared.ok) return failure(prepared.message);
    const { t, context, reconciliation } = prepared;

    if (reconciliation.report.blocking.length > 0) return failure(t.massar.errors.blocked);

    const result = await adoptFromFile(
      context,
      reconciliation,
      reconciliation.db.assessment?.id ?? null,
    );

    const fields = [
      result.school,
      result.schoolClass,
      result.subject,
      result.term,
      result.assessment,
    ].filter(Boolean).length;

    if (fields === 0 && result.pupils === 0) return failure(t.massar.errors.nothingToAdopt);

    refresh();
    return success(interpolate(t.massar.adopted, { fields, pupils: result.pupils }));
  });
}
