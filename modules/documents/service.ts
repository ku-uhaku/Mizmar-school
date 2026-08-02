import "server-only";

import { db } from "@/lib/db";
import { acceptsReceivedOn } from "@/modules/documents/enums";

/**
 * Writes and invariants for the documents module.
 *
 * One rule worth a service layer, and it is the one a form cannot be trusted
 * with: the date of receipt belongs to RECEIVED and to nothing else. A dossier
 * that says a pièce was refused on the 12th of September is a dossier somebody
 * will read as "we have it".
 */

export type RecordInput = {
  studentId: string;
  documentTypeId: string;
  status: string;
  receivedOn: Date | null;
  reference: string | null;
  notes: string | null;
  recordedById: string;
};

export type RecordResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Records where one pièce of one pupil's dossier has got to.
 *
 * ── Both ends are re-derived against the school ─────────────────────────────
 * The pupil and the pièce are looked up under `schoolId` before anything is
 * written, so a crafted `studentId` or `documentTypeId` from another school
 * matches nothing and the call reports not-found rather than writing a row that
 * crosses two tenants. That is the whole reason this is not a bare upsert.
 *
 * ── MISSING clears the row rather than storing it ───────────────────────────
 * Setting a pièce back to missing deletes the record instead of writing
 * `status: "MISSING"`. Absence is the default and is derived — see the note on
 * StudentDocument — so a stored MISSING row would be a second way of saying the
 * same thing, and the two would eventually disagree.
 */
export async function recordDocument(
  input: RecordInput,
  schoolId: string,
): Promise<RecordResult> {
  const [student, type] = await Promise.all([
    db.student.findFirst({
      where: { id: input.studentId, schoolId },
      select: { id: true },
    }),
    db.documentType.findFirst({
      where: { id: input.documentTypeId, schoolId },
      select: { id: true },
    }),
  ]);
  if (!student || !type) return { ok: false, reason: "not-found" };

  const key = {
    studentId_documentTypeId: {
      studentId: student.id,
      documentTypeId: type.id,
    },
  };

  if (input.status === "MISSING") {
    await db.studentDocument.deleteMany({
      where: { studentId: student.id, documentTypeId: type.id },
    });
    return { ok: true };
  }

  const data = {
    status: input.status,
    // The invariant: a date of receipt exists only where something was
    // received. Cleared rather than kept, so re-refusing a pièce that had been
    // accepted does not leave last month's date attached to the refusal.
    receivedOn: acceptsReceivedOn(input.status) ? input.receivedOn : null,
    reference: input.reference,
    notes: input.notes,
    recordedById: input.recordedById,
  };

  await db.studentDocument.upsert({
    where: key,
    update: data,
    create: { studentId: student.id, documentTypeId: type.id, ...data },
  });

  return { ok: true };
}
