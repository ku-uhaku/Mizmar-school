import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Five codes because a bulletin passes through four different pairs of hands,
 * and the whole reason schools ask for this feature is that those hands must
 * not be interchangeable:
 *
 *   COMPUTE      the office works out the term's figures for a class
 *   APPRECIATE   a subject teacher writes their line about a pupil
 *   COUNCIL      the conseil de classe awards the mention and decides the year
 *   PUBLISH      the bulletin leaves the building
 *
 * The split that matters most is APPRECIATE against COUNCIL. A teacher must be
 * able to write "élève sérieux, doit participer davantage" against their own
 * subject without being able to decide that the child repeats the year — those
 * are not the same authority, and a single "edit bulletin" code would hand over
 * both. PUBLISH is separate again for the reason ASSESSMENT_PUBLISH is: a
 * document a family has read cannot be unread, and deciding it is ready is the
 * head's call rather than a consequence of somebody finishing their typing.
 */
export const BULLETIN_PERMISSIONS = definePermissions({
  BULLETIN_VIEW: "bulletin.view",
  BULLETIN_COMPUTE: "bulletin.compute",
  BULLETIN_APPRECIATE: "bulletin.appreciate",
  BULLETIN_COUNCIL: "bulletin.council",
  BULLETIN_PUBLISH: "bulletin.publish",
});
