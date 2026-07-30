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
    subtitle: "Vue d'ensemble de votre organisation.",
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
    superAdminNote: "Vous êtes super administrateur — toutes les permissions sont accordées.",
    quickActions: "Actions rapides",
    recentSchools: "Écoles",
    noSchools: "Aucune école pour le moment.",
    welcome: "Bon retour, {name}.",
    overview: "Aperçu",
    preview: "Démo",
    previewNote: "Données de démonstration. Ces indicateurs se brancheront sur les tables pédagogiques dès leur arrivée.",
    students: "Élèves",
    teachers: "Enseignants",
    attendance: "Assiduité",
    feesCollected: "Frais encaissés",
    vsLastMonth: "vs mois dernier",
    enrolmentTrend: "Évolution des effectifs",
    enrolmentTrendHint: "Effectif à la fin de chaque mois.",
    studentsByLevel: "Élèves par niveau",
    studentsByLevelHint: "Répartition sur le cycle complet.",
    studentsBySchool: "Répartition par école",
    studentsBySchoolHint: "Part de l'effectif total.",
    capacity: "Taux de remplissage",
    capacityCaption: "{enrolled} inscrits sur {capacity} places.",
    viewData: "Voir les données",
    month: "Mois",
    level: "Niveau",
    recentActivity: "Activité récente",
    upcoming: "Prochaines échéances",
    inDays: "dans {count} jours",
    minutesAgo: "il y a {count} min",
    hoursAgo: "il y a {count} h",
    daysAgo: "il y a {count} j",
    activity: {
      enrolment: "a inscrit un nouvel élève",
      payment: "a enregistré un paiement",
      grades: "a saisi des notes",
      absence: "a justifié une absence",
      staff: "a mis à jour une fiche personnel",
    },
    deadlines: {
      councils: "Conseils de classe",
      reportCards: "Envoi des bulletins",
      feesDue: "Échéance des frais du trimestre",
      termEnd: "Fin du trimestre",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  dashboard: "Tableau de bord",
};

export default fr;
