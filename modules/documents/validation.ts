import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { enumField, optionalDate, optionalText, requiredText } from "@/lib/validation";
import { DOCUMENT_STATUSES } from "@/modules/documents/enums";

/** Built per-request from the dictionary so messages come back localised. */

/**
 * One line of a dossier, as the guichet posts it.
 *
 * The pupil and the pièce travel as ids and are re-derived against the school
 * before anything is written — see `recordDocument`. Neither is trusted here;
 * this only checks they are the right shape.
 */
export function studentDocumentSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    studentId: requiredText(v, { max: 40 }),
    documentTypeId: requiredText(v, { max: 40 }),
    status: enumField(DOCUMENT_STATUSES, v),
    receivedOn: optionalDate(v),
    /// The document's own number — a numéro d'acte, a CIN.
    reference: optionalText(60),
    notes: optionalText(500),
  });
}
