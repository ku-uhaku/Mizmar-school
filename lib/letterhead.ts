import "server-only";

import type { AuthContext } from "@/lib/dal";
import type { PrintLetterhead } from "@/components/print/print-document";

/**
 * The identity block at the top of every printed document.
 *
 * Read from the working context rather than queried: the school and the
 * organisation are already on `AuthContext`, and a document must be headed by
 * the school the user is actually working in — not by one named in the URL.
 * That also means a receipt can never come out on another school's letterhead.
 */
export function letterheadFrom(context: AuthContext): PrintLetterhead {
  const school = context.currentSchool;

  return {
    organizationName: context.organization.name,
    schoolName: school?.name ?? null,
    // The school's own crest when it has one, the organisation's otherwise —
    // the same fallback the sidebar uses, so paper and screen agree.
    logoUrl: school?.logoUrl ?? context.organization.logoUrl,
    addressLine: school?.addressLine ?? context.organization.addressLine,
    city: school?.city ?? context.organization.city,
    phone: school?.phone ?? context.organization.phone,
    email: school?.email ?? context.organization.email,
    website: school?.website ?? context.organization.website,
  };
}
