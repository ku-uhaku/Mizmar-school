import { definePermissions } from "@/lib/module";

/**
 * This module's permission codes. Aggregated into the app-wide `PERMISSIONS`
 * object by `modules/registry.ts`; seeded into the Permission table from there.
 *
 * Every code needs a label in `i18n/*.ts` (`permissions.codes`) — the matrix
 * renders from the dictionary, so a code without one shows up blank.
 */
export const ORGANIZATION_PERMISSIONS = definePermissions({
  ORGANIZATION_VIEW: "organization.view",
  ORGANIZATION_UPDATE: "organization.update",
});
