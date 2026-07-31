/**
 * Schools translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  school: {
    title: "Écoles",
    subtitle: "Toutes les écoles gérées par l'organisation.",
    newSchool: "Nouvelle école",
    editSchool: "Modifier l'école",
    createSchool: "Créer l'école",
    code: "Code",
    codeHint: "Identifiant court et unique, ex. AL-AMAL-CASA",
    name: "Nom",
    level: "Niveau",
    director: "Directeur",
    capacity: "Capacité",
    email: "E-mail",
    phone: "Téléphone",
    website: "Site web",
    logoUrl: "Logo",
    logoHint: "Affiché dans la barre latérale quand cette école est sélectionnée.",
    addressLine: "Adresse",
    city: "Ville",
    region: "Région",
    postalCode: "Code postal",
    country: "Pays",
    status: "Statut",
    statusDescription: "Une école inactive reste listée mais est signalée partout.",
    years: "Années",
    members: "Membres",
    created: "École créée.",
    updated: "École mise à jour.",
    deleted: "École supprimée.",
    deleteTitle: "Supprimer cette école ?",
    deleteBody: "« {name} » ainsi que toutes ses années scolaires et affectations seront définitivement supprimées.",
    codeTaken: "Ce code est déjà utilisé par une autre école.",
    noSchools: "Aucune école pour le moment. Créez la première.",
    searchPlaceholder: "Rechercher par nom, code ou ville…",
    levels: {
      PRESCHOOL: "Maternelle",
      PRIMARY: "Primaire",
      MIDDLE: "Collège",
      HIGH: "Lycée",
      GROUP: "Groupe scolaire",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  schools: "Écoles",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    school: "Écoles",
  },
  codes: {
    "school.view": "Consulter les écoles",
    "school.create": "Créer des écoles",
    "school.update": "Modifier les écoles",
    "school.delete": "Supprimer des écoles",
  },
};

export default fr;
