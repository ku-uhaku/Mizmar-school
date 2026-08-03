import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * One code, and it does not stand alone. Importing writes the same rows the
 * pupil and dossier forms write, so the action asserts `STUDENT_CREATE` and
 * `FAMILY_CREATE` alongside it — otherwise a role granted only this would be a
 * way to create four hundred pupils without holding the permission to create
 * one. What this code adds on top is the *bulk* of it, which is a decision a
 * school makes about a person rather than about a screen.
 *
 * Exporting needs no code of its own: it reads what `STUDENT_VIEW` and
 * `FAMILY_VIEW` already allow, in a different file format.
 */
export const IMPORT_PERMISSIONS = definePermissions({
  IMPORT_STUDENTS: "import.students",
});
