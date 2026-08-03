import { defineModule } from "@/lib/module";
import { IMPORT_PERMISSIONS } from "@/modules/imports/permissions";

/**
 * Bulk loading, and the export that feeds it.
 *
 * Owns no tables: it writes `Student`, `Family` and `Guardian` through the
 * services that own their invariants, exactly as the forms do. It exists as a
 * module rather than as a corner of `students` because it spans two domains and
 * neither owner should acquire the other's write path.
 *
 * No nav entry — the screen is reached from the pupils list, which is where
 * somebody holding a spreadsheet is already standing.
 */
export const importsModule = defineModule({
  id: "imports",
  permissions: [
    { group: "import", codes: Object.values(IMPORT_PERMISSIONS) },
  ],
});
