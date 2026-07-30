/**
 * Organisation translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  organization: {
    title: "Organisation",
    subtitle: "Détails de l'organisation qui gère toutes les écoles.",
    general: "Général",
    name: "Nom",
    legalName: "Raison sociale",
    ice: "ICE",
    iceHint: "Identifiant Commun de l'Entreprise",
    taxId: "Identifiant fiscal",
    defaultLocale: "Langue par défaut",
    contact: "Contact",
    email: "E-mail",
    phone: "Téléphone",
    website: "Site web",
    address: "Adresse",
    addressLine: "Adresse",
    city: "Ville",
    region: "Région",
    postalCode: "Code postal",
    country: "Pays",
    logoUrl: "URL du logo",
    updated: "Organisation mise à jour.",
    stats: "En bref",
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  organization: "Organisation",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    organization: "Organisation",
  },
  codes: {
    "organization.view": "Consulter l'organisation",
    "organization.update": "Modifier l'organisation",
  },
};

export default fr;
