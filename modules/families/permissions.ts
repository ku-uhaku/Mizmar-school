import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Guardians have no codes of their own: they are rows inside a dossier, and
 * anyone who may edit the family may edit who is on it. A separate
 * `guardian.update` would be a permission no role would ever be granted apart
 * from `family.update`.
 */
export const FAMILY_PERMISSIONS = definePermissions({
  FAMILY_VIEW: "family.view",
  FAMILY_CREATE: "family.create",
  FAMILY_UPDATE: "family.update",
  FAMILY_DELETE: "family.delete",
});
