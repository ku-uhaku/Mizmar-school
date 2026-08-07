import "server-only";

import { db } from "@/lib/db";

/**
 * Reads for the organization module.
 *
 * The only one there is, and it exists for the sign-in screen — every other
 * caller already holds the organisation on its `AuthContext`, which is derived
 * from the session and needs no query.
 */

export type OrganizationBrand = {
  name: string;
  logoUrl: string | null;
};

/**
 * The group's name and crest, for a screen with no session yet.
 *
 * ── Why an unauthenticated read is acceptable here, and only here ────────────
 * The login page is public by definition, and what it shows is the branding of
 * the group whose login page it is — the name over the door and the crest on
 * it. Neither is a secret from somebody standing at the door.
 *
 * The select is exhaustive on purpose rather than returning the row: an
 * organisation carries an address, a licence and contact details, and none of
 * that belongs to an unauthenticated caller. Adding a column to the table must
 * not silently widen what this hands out.
 *
 * `findFirst` because the app is one group per deployment — the same assumption
 * `seedOrganization` makes.
 */
export async function loadOrganizationBrand(): Promise<OrganizationBrand | null> {
  const organization = await db.organization.findFirst({
    select: { name: true, logoUrl: true },
  });

  return organization ?? null;
}
