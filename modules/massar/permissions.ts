import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * The split follows what each direction can actually damage.
 *
 * `MASSAR_RECONCILE` reads a file and says whether it matches. It writes
 * nothing, so a secretary can be handed it to answer "is this the right class?"
 * without being able to act on the answer.
 *
 * `MASSAR_IMPORT` writes marks the ministry sent us. It is asserted alongside
 * `ASSESSMENT_GRADE` rather than instead of it — otherwise a role granted only
 * this would be a way to enter marks for a whole class without holding the
 * permission to enter one.
 *
 * `MASSAR_MAP` is separate because it is the one that changes identity rather
 * than data: adopting a code from a file decides that *this* class is *that*
 * class in the ministry's records, and everything filed afterwards depends on
 * somebody senior having got it right.
 *
 * Exporting a filled template needs `MASSAR_EXPORT` and nothing else — it reads
 * marks the holder could already see and writes them into a spreadsheet.
 */
export const MASSAR_PERMISSIONS = definePermissions({
  MASSAR_RECONCILE: "massar.reconcile",
  MASSAR_IMPORT: "massar.import",
  MASSAR_EXPORT: "massar.export",
  MASSAR_MAP: "massar.map",
});
