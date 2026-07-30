import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * One code. This module owns no tables and shows nothing of its own — it
 * composes the other modules' figures, and each of those is already scoped to
 * what the reader may see. What this permission grants is the *overview*: the
 * right to look at the year as a whole rather than one child at a time.
 */
export const SCHOOL_LIFE_PERMISSIONS = definePermissions({
  SCHOOL_LIFE_VIEW: "schoolLife.view",
});
