import { defineModule } from "@/lib/module";
import { DOCUMENT_PERMISSIONS } from "@/modules/documents/permissions";

/**
 * Documents owns the dossier d'inscription: the pièces a school asks for, and
 * which of them it holds for each pupil.
 *
 * It contributes no nav entry. A dossier is always read about a particular
 * child — it is a tab on the pupil's file and a step of their parcours — and a
 * bare list of every document in the school is a screen nobody opens. The
 * catalogue is configured under `/configuration`, like every other reference
 * table.
 */
export const documentsModule = defineModule({
  id: "documents",
  schemaFolder: "documents",
  permissions: [
    { group: "document", codes: Object.values(DOCUMENT_PERMISSIONS) },
  ],
});
