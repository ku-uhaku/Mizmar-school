import { definePermissions } from "@/lib/module";

/**
 * Configuration is one permission pair rather than one per table.
 *
 * The fourteen configuration screens are a single job — setting the school up —
 * and are done by the same one or two people. Fifty-six codes would be a matrix
 * nobody reads, and the tables are already protected by the working context:
 * a school-scoped role can only ever configure its own school.
 */
export const CONFIGURATION_PERMISSIONS = definePermissions({
  CONFIGURATION_VIEW: "configuration.view",
  CONFIGURATION_MANAGE: "configuration.manage",
});
