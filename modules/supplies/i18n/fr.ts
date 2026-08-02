/**
 * Supplies translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  supply: {
    title: "Fournitures scolaires",
    subtitle: "Ce que chaque classe doit apporter, et qui l'a validé.",
    newList: "Nouvelle liste",
    editList: "Modifier la liste",
    list: "Liste",
    lists: "Listes",
    noLists: "Aucune liste de fournitures.",
    noListsHint:
      "Rédigez-en une pour une classe, puis envoyez-la à la direction pour validation.",
    listTitle: "Intitulé",
    listTitlePlaceholder: "Rentrée 2025 — 3AP",
    class: "Classe",
    subject: "Matière",
    subjectHint: "Laisser vide pour la liste générale de la classe.",
    notes: "Remarques pour les familles",
    notesHint:
      "Où acheter, quand apporter — tout ce que les articles ne disent pas.",
    items: "Articles",
    itemsHint: "Une ligne par article, pour que le parent puisse cocher.",
    addItem: "Ajouter un article",
    itemLabel: "Article",
    itemLabelPlaceholder: "Cahier 96 pages, grands carreaux",
    itemLabelAr: "Article (arabe)",
    quantity: "Qté",
    itemNotes: "Précision",
    required: "Obligatoire",
    optional: "Facultatif",
    itemCount: "{count} articles",
    pickArticle: "Choisir un article…",
    articleWithdrawn:
      "« {label} » n’est plus au catalogue — choisissez son remplaçant.",
    noArticles:
      "Le catalogue de fournitures est vide. Ajoutez-y des articles dans Configuration → Logistique.",
    author: "Rédigée par",
    reviewedBy: "Décidée par",
    submit: "Envoyer pour validation",
    submitted: "Envoyée à la direction.",
    approve: "Valider",
    approved: "Liste validée — les familles la voient désormais.",
    reject: "Refuser",
    rejected: "Liste refusée.",
    withdraw: "Retirer",
    withdrawn: "Liste retirée aux familles.",
    reviewNote: "Motif",
    reviewNoteHint: "Visible par l'enseignant, jamais par une famille.",
    awaitingReview: "En attente de validation",
    awaitingReviewHint: "Les listes que la direction n'a pas encore tranchées.",
    onlyApprovedVisible:
      "Seules les listes validées sont visibles par les familles.",
    notYourList: "Cette liste n'est pas la vôtre.",
    alreadyDecided: "Cette liste a déjà été tranchée.",
    cannotEditApproved:
      "Une liste validée ne peut pas être modifiée — retirez-la d'abord.",
    created: "Liste créée.",
    saved: "Liste enregistrée.",
    deleted: "Liste supprimée.",
    deleteTitle: "Supprimer cette liste ?",
    deleteBody: "« {name} » sera supprimée.",
    print: "Imprimer la liste",
  },
  supplyOptions: {
    categories: {
      ECRITURE: "Écriture",
      CAHIERS: "Cahiers",
      COUVERTURES: "Couvertures",
      CLASSEMENT: "Classement",
      GEOMETRIE: "Géométrie",
      ARTS: "Arts plastiques",
      CARTABLE: "Cartable et trousse",
      SPORT: "Sport",
      HYGIENE: "Hygiène",
      AUTRE: "Divers",
    },
    statuses: {
      DRAFT: "Brouillon",
      SUBMITTED: "En attente de validation",
      APPROVED: "Validée",
      REJECTED: "Refusée",
    },
  },
};

export const nav = {
  supplies: "Fournitures",
};

export const permissions = {
  groups: {
    supply: "Fournitures scolaires",
  },
  codes: {
    "supply.view": "Consulter les listes de fournitures",
    "supply.write": "Rédiger et envoyer des listes de fournitures",
    "supply.review": "Valider ou refuser les listes de fournitures",
    "supply.delete": "Supprimer des listes de fournitures",
  },
};

export default fr;
