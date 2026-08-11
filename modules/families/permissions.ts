import { definePermissions } from "@/lib/module";

/**
 * See modules/organization/permissions.ts for the contract.
 *
 * Guardians have no codes of their own: they are rows inside a dossier, and
 * anyone who may edit the family may edit who is on it. A separate
 * `guardian.update` would be a permission no role would ever be granted apart
 * from `family.update`.
 *
 * `family.portal` is the exception, and the reason is that it is not a dossier
 * field at all: it mints a credential. Editing a parent's telephone number and
 * handing that parent a login are different authorities, and a school that wants
 * its secretaries keeping the files up to date without opening accounts has to
 * be able to say so.
 *
 * ── Why it does not also require USER_CREATE ────────────────────────────────
 * The staff form does assert that code alongside its own (modules/hr/actions.ts)
 * because it can attach a role and a membership — it genuinely mints staff. This
 * one cannot: the account it opens is role-less, membership-less and reaches
 * exactly one dossier, so `family.portal` is the *narrower* authority, not a
 * shortcut around the broader one. Requiring both would leave the code grantable
 * only to a director, who could already open the account by hand.
 */
export const FAMILY_PERMISSIONS = definePermissions({
  FAMILY_VIEW: "family.view",
  FAMILY_CREATE: "family.create",
  FAMILY_UPDATE: "family.update",
  FAMILY_DELETE: "family.delete",
  FAMILY_PORTAL: "family.portal",
});
