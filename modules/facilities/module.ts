import { defineModule } from "@/lib/module";

/**
 * Physical spaces: rooms, labs, workshops, sports facilities.
 *
 * Separate from `academics` because a room is not curriculum — it is an asset
 * with a capacity and a location, and the timetable is what brings the two
 * together.
 *
 * No nav or permissions yet — tables only.
 */
export const facilitiesModule = defineModule({
  id: "facilities",
  schemaFolder: "facilities",
});
