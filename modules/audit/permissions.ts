import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Two codes rather than one, because the trail answers two different questions
 * and a school will not always want the same person answering both.
 *
 * `audit.view` is "who changed this pupil's fee?" — an administrative question,
 * asked by whoever is answerable for the data, and the reason the feature
 * exists. `audit.security` is "who tried to get in, and who was refused?" —
 * which is about the people, not the records, and reading it is closer to
 * reading a door log than to reading a file. The second is deliberately not
 * implied by the first.
 */
export const AUDIT_PERMISSIONS = definePermissions({
  /** Read the trail of what was created, changed and deleted. */
  AUDIT_VIEW: "audit.view",
  /** Read sign-ins, refused passwords and refused permissions. */
  AUDIT_SECURITY: "audit.security",
});
