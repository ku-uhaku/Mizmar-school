/**
 * Organisation translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  organization: {
    title: "Organisation",
    subtitle: "Details of the organisation that owns every school.",
    general: "General",
    name: "Name",
    legalName: "Legal name",
    ice: "ICE",
    iceHint: "Moroccan Common Enterprise Identifier",
    taxId: "Tax ID",
    defaultLocale: "Default language",
    contact: "Contact",
    email: "Email",
    phone: "Phone",
    website: "Website",
    address: "Address",
    addressLine: "Street address",
    city: "City",
    region: "Region",
    postalCode: "Postal code",
    country: "Country",
    logoUrl: "Logo URL",
    logoHint: "Shown in the sidebar and on your paperwork.",
    updated: "Organisation updated.",
    stats: "At a glance",
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  organization: "Organisation",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    organization: "Organisation",
  },
  codes: {
    "organization.view": "View the organisation",
    "organization.update": "Update the organisation",
  },
} as const;

export default en;
