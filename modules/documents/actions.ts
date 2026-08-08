"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { formValues } from "@/lib/form-values";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { fieldErrors } from "@/lib/validation";
import { recordDocument, setDocumentReceived } from "@/modules/documents/service";
import {
  studentDocumentSchema,
  toggleDocumentSchema,
} from "@/modules/documents/validation";

/**
 * Actions for the documents module.
 *
 * The school comes from the working context and never from the form, and the
 * authorization is the first thing the body does — a Server Function is
 * reachable by direct POST, so the panel that draws the controls protects
 * nothing on its own.
 */

export async function recordStudentDocumentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();
    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.DOCUMENT_MANAGE);

    const parsed = studentDocumentSchema(t).safeParse({
      studentId: field(formData, "studentId"),
      documentTypeId: field(formData, "documentTypeId"),
      status: field(formData, "status"),
      receivedOn: field(formData, "receivedOn"),
      reference: field(formData, "reference"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const result = await recordDocument(
      {
        studentId: parsed.data.studentId,
        documentTypeId: parsed.data.documentTypeId,
        status: parsed.data.status,
        receivedOn: parsed.data.receivedOn,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        recordedById: context.user.id,
      },
      schoolId,
    );
    if (!result.ok) return failure(t.errors.notFound);

    refresh();
    return success(t.document.recorded);
  });
}

/**
 * Marks one pièce reçu, or takes it back to manquant — the dossier's switch.
 *
 * Authorized against the same permission as the dialog it sits beside. A
 * control that is one click is not a control that is less protected: this is a
 * Server Function like any other, reachable by direct POST whether or not the
 * panel drew the switch.
 */
export async function toggleStudentDocumentAction(
  studentId: string,
  documentTypeId: string,
  received: boolean,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();
    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.DOCUMENT_MANAGE);

    const parsed = toggleDocumentSchema(t).safeParse({
      studentId,
      documentTypeId,
    });
    if (!parsed.success) {
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const result = await setDocumentReceived(
      {
        studentId: parsed.data.studentId,
        documentTypeId: parsed.data.documentTypeId,
        received,
        recordedById: context.user.id,
      },
      schoolId,
    );
    if (!result.ok) return failure(t.errors.notFound);

    refresh();
    return success(received ? t.document.markedReceived : t.document.markedMissing);
  });
}
