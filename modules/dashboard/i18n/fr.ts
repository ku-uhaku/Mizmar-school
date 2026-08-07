/**
 * Dashboard translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const fr = {
  dashboard: {
    title: "Tableau de bord",
    welcome: "Bon retour, {name}.",

    // ── Les quatre sections de travail ──────────────────────────────────────
    sections: "Vos sections",
    quickActions: "Accès rapide",

    charts: "L'année en un coup d'œil",
    pupilsPerLevel: "Élèves par niveau",
    pupilsPerLevelHint:
      "Comment l'effectif de cette année se répartit sur les niveaux ouverts.",
    pupilsUnit: "élèves",
    levelLabel: "Niveau",
    collectionTrend: "Encaissé chaque mois",
    collectionTrendHint:
      "Les reçus établis, mois par mois. Les reçus annulés sont exclus.",
    collectionSplit: "Les frais de l'année",
    collectionSplitHint: "Ce qui est réglé face à ce qui reste dû.",
    paidLabel: "Réglé",
    outstandingLabel: "Restant dû",
    collectionRate: "Taux de recouvrement",
    overdueNote: "{amount} sont déjà échus.",
    monthLabel: "Mois",
    noChartData: "Rien à représenter pour l'instant.",
    vieScolaireHint: "Les familles, les enfants et l'année qu'ils suivent.",
    financeHint: "Ce qui entre, ce qui sort, et ce que les caisses contiennent.",
    logistiqueHint: "Le parc, les lignes qu'il dessert et qui les emprunte.",
    rhHint: "Tous ceux que l'école paie, et ce que cela implique.",
    students: "Élèves",
    enrolledCount: "{count} inscrits",
    toPlaceCount: "{count} à affecter",
    linesCount: "{count} lignes",
    leaveRequestCount: "{count} demandes de congé",

    // ── Administration ──────────────────────────────────────────────────────
    schools: "Écoles",
    activeSchools: "actives",
    users: "Utilisateurs",
    activeUsers: "actifs",
    roles: "Rôles",
    rolesDetail: "Niveaux d'accès",
    schoolYears: "Années scolaires",
    currentContext: "Votre contexte de travail",
    yourPermissions: "Vos permissions ici",
    permissionCount: "{count} permissions dans cette école",
    superAdminNote:
      "Vous êtes super administrateur — toutes les permissions sont accordées.",
    recentSchools: "Écoles",
    noSchools: "Aucune école pour le moment.",

    viewData: "Voir les données",
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  dashboard: "Tableau de bord",
};

export default fr;
