/**
 * Events translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  event: {
    title: "Événements",
    subtitle: "Ce que l'école annonce à ses familles.",
    newEvent: "Nouvel événement",
    editEvent: "Modifier l'événement",
    eventTitle: "Intitulé",
    titleAr: "Intitulé (en arabe)",
    description: "Détails",
    descriptionHint: "Ce que le parent lit sous l'intitulé.",
    kind: "Type",
    status: "Statut",
    startsAt: "Début",
    endsAt: "Fin",
    endsAtHint: "Laissez vide pour un événement d'une seule journée.",
    allDay: "Toute la journée",
    allDayHint:
      "Sans heure — le parent ne voit que la date, ce qui convient à la plupart des annonces.",
    location: "Lieu",
    locationHint: "Texte libre : une salle, la cour, un musée.",
    audience: "Destinataires",
    schoolWide: "Toute l'école",
    schoolWideHint: "Toutes les familles le voient.",
    chosenAudience: "Niveaux et classes choisis",
    levels: "Niveaux",
    classes: "Classes",
    audienceEmpty:
      "Choisissez au moins un niveau ou une classe, ou visez toute l'école — un événement que personne ne peut voir ne peut pas être publié.",
    audienceCount: "{count} destinataires",

    // ── Publication ────────────────────────────────────────────────────────
    publish: "Publier",
    publishTitle: "Publier cet événement ?",
    publishBody:
      "« {title} » devient visible par toutes les familles concernées. Elles le voient aussitôt sur leur téléphone.",
    published: "Événement publié.",
    publishedOn: "Publié le {date}",
    publishedBy: "Publié par {name}",
    unpublish: "Remettre en brouillon",
    unpublishTitle: "Remettre cet événement en brouillon ?",
    unpublishBody:
      "« {title} » cesse d'être visible par les familles. Celles qui l'ont déjà vu ne le retrouveront simplement plus.",
    unpublished: "Remis en brouillon.",
    cancelEvent: "Annuler l'événement",
    cancelTitle: "Annuler cet événement ?",
    cancelBody:
      "« {title} » reste visible par les familles, signalé comme annulé — c'est bien le but. Le supprimer enverrait un parent devant un portail fermé.",
    cannotPublishCancelled:
      "Cet événement a été annulé. Les familles en ont été informées : créez une nouvelle annonce plutôt que de rétablir celle-ci.",
    cancelled: "Événement annulé.",
    saved: "Événement enregistré.",
    deleted: "Événement supprimé.",
    deleteTitle: "Supprimer cet événement ?",
    deleteBody: "« {title} » sera supprimé.",
    deletePublished:
      "Cet événement a été annoncé — annulez-le plutôt, pour que les familles soient prévenues.",

    // ── La liste ───────────────────────────────────────────────────────────
    upcoming: "À venir",
    past: "Passés",
    drafts: "Brouillons",
    noEvents: "Rien d'annoncé pour l'instant.",
    noEventsHint: "Créez un événement, puis publiez-le pour que les familles le voient.",
    noUpcoming: "Rien à venir.",
    allDayBadge: "Toute la journée",
    searchPlaceholder: "Rechercher par intitulé ou par lieu…",
    startAfterEnd: "La fin ne peut pas précéder le début.",
    outsideYear: "Cette date se situe hors de l'année scolaire.",
  },
  eventOptions: {
    kinds: {
      MEETING: "Réunion",
      OUTING: "Sortie",
      CEREMONY: "Cérémonie",
      EXAM: "Examens",
      HOLIDAY_INFO: "Vacances",
      OTHER: "Autre",
    },
    statuses: {
      DRAFT: "Brouillon",
      PUBLISHED: "Publié",
      CANCELLED: "Annulé",
    },
  },
} as const;

export const nav = {
  events: "Événements",
};

export const permissions = {
  groups: {
    event: "Événements",
  },
  codes: {
    "event.view": "Consulter les événements",
    "event.manage": "Créer et modifier les événements",
    "event.publish": "Publier et annuler les événements",
    "event.delete": "Supprimer les événements",
  },
};

export default fr;
