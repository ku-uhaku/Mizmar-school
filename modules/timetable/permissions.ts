import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Two codes rather than four: a grid is drawn, adjusted and cleared as one
 * piece of work, and nobody is ever granted "may add a lesson but not remove
 * one". The bell schedule itself (TimeSlot) stays under `configuration.*` —
 * that is a decision about the school year, not about one class's week.
 */
export const TIMETABLE_PERMISSIONS = definePermissions({
  TIMETABLE_VIEW: "timetable.view",
  TIMETABLE_MANAGE: "timetable.manage",
});
