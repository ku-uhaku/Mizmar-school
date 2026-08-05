import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import { schoolScope } from "@/lib/scope";
import { dossierStandingOf, type DossierStanding } from "@/modules/documents/enums";

/**
 * Reads for the documents module.
 *
 * Confined to `context.currentSchool` throughout — a dossier belongs to a pupil
 * of one school, and the catalogue it is read against is that school's own.
 */

/** One line of a dossier: the pièce asked for, and where it has got to. */
export type DossierPiece = {
  documentTypeId: string;
  code: string;
  name: string;
  nameAr: string | null;
  isRequired: boolean;
  copies: number | null;
  /** The catalogue's own note — where to get it, how recent it must be. */
  typeNotes: string | null;
  /** Derived MISSING when nothing has been recorded — see StudentDocument. */
  status: string;
  /** `YYYY-MM-DD` for `<input type="date">`, empty while not received. */
  receivedOn: string;
  reference: string | null;
  notes: string | null;
  recordedByName: string | null;
};

export type StudentDossier = {
  pieces: DossierPiece[];
  standing: DossierStanding;
};

/**
 * A pupil's dossier: every pièce the school currently asks for, each with what
 * is known about it.
 *
 * ── The catalogue leads, not the rows ────────────────────────────────────────
 * The list is built from the *active* catalogue and the recorded rows are
 * joined onto it, rather than the other way round. That is what makes a pièce
 * added on Monday appear on every dossier on Tuesday, and a pièce withdrawn
 * from the catalogue stop being asked for without touching a single dossier.
 * A recorded row whose type has since been withdrawn simply drops out of the
 * checklist — the row survives, and the paper is still in the drawer.
 */
export async function loadStudentDossier(
  context: AuthContext,
  studentId: string,
): Promise<StudentDossier> {
  // The pupil is re-derived against the school so a crafted id reads as a pupil
  // with no dossier rather than reaching another school's records.
  const [types, recorded] = await Promise.all([
    db.documentType.findMany({
      where: { ...schoolScope(context), isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        nameAr: true,
        isRequired: true,
        copies: true,
        notes: true,
      },
    }),
    db.studentDocument.findMany({
      where: { studentId, student: schoolScope(context) },
      select: {
        documentTypeId: true,
        status: true,
        receivedOn: true,
        reference: true,
        notes: true,
        recordedBy: {
          select: {
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  const byType = new Map(recorded.map((row) => [row.documentTypeId, row]));

  const pieces: DossierPiece[] = types.map((type) => {
    const row = byType.get(type.id);
    return {
      documentTypeId: type.id,
      code: type.code,
      name: type.name,
      nameAr: type.nameAr,
      isRequired: type.isRequired,
      copies: type.copies,
      typeNotes: type.notes,
      status: row?.status ?? "MISSING",
      receivedOn: toDateInputValue(row?.receivedOn ?? null),
      reference: row?.reference ?? null,
      notes: row?.notes ?? null,
      recordedByName: row?.recordedBy ? displayName(row.recordedBy) : null,
    };
  });

  return { pieces, standing: dossierStandingOf(pieces) };
}

/**
 * How each pupil's dossier stands, for a whole list of them.
 *
 * One pass for the lot rather than `loadStudentDossier` per row: the pupils
 * screen shows this against several hundred children, and a query apiece is the
 * difference between a page and a timeout.
 */
export async function dossierStandingByStudent(
  context: AuthContext,
  studentIds: string[],
): Promise<Record<string, DossierStanding>> {
  if (studentIds.length === 0) return {};

  const [types, recorded] = await Promise.all([
    db.documentType.findMany({
      where: { ...schoolScope(context), isActive: true },
      select: { id: true, isRequired: true },
    }),
    db.studentDocument.findMany({
      where: { studentId: { in: studentIds }, student: schoolScope(context) },
      select: { studentId: true, documentTypeId: true, status: true },
    }),
  ]);

  const byStudent = new Map<string, Map<string, string>>();
  for (const row of recorded) {
    const held = byStudent.get(row.studentId) ?? new Map<string, string>();
    held.set(row.documentTypeId, row.status);
    byStudent.set(row.studentId, held);
  }

  return Object.fromEntries(
    studentIds.map((studentId) => {
      const statuses = byStudent.get(studentId);
      return [
        studentId,
        dossierStandingOf(
          types.map((type) => ({
            isRequired: type.isRequired,
            status: statuses?.get(type.id) ?? "MISSING",
          })),
        ),
      ] as const;
    }),
  );
}

export type DocumentTypeChoice = {
  id: string;
  code: string;
  name: string;
  isRequired: boolean;
};

/** The school's catalogue, for anything that needs to name a pièce. */
export async function listDocumentTypes(
  context: AuthContext,
): Promise<DocumentTypeChoice[]> {
  return db.documentType.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, isRequired: true },
  });
}
