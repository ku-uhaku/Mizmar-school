/**
 * Assessments translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * there is a compile error until this file supplies it.
 */
const fr = {
  assessment: {
    generatedAcross: "{count} contrôles créés sur {classes} classes.",
    willCover: "{classes} classes · {subjects} matières chacune",
    scope: "Portée",
    scopeHint:
      "Une série de contrôles se prépare normalement pour tout un niveau à la fois.",
    scopeClass: "Une classe",
    scopeLevel: "Un niveau",
    scopeYear: "Toute l'année",
    pickLevel: "Niveau",
    assessment: "Épreuve",
    noMarksYet: "Aucune note pour le moment.",
    noMarksHint: "Les notes apparaissent ici au fur et à mesure des saisies.",
    overallAverage: "Moyenne générale",
    marksCounted: "{count} notes saisies",
    coefficientShort: "coeff. {value}",
    notCounted: "hors moyenne",
    title: "Contrôles",
    subtitle: "Le travail noté du semestre, et les notes qui vont avec.",

    // ── La liste ────────────────────────────────────────────────────────────
    paper: "Contrôle",
    papers: "Contrôles",
    noAssessments: "Aucun contrôle prévu pour cette classe et ce semestre.",
    noAssessmentsHint:
      "Générez toute une série d'un coup, ou ajoutez un contrôle à la main.",
    searchPlaceholder: "Rechercher par intitulé, matière ou classe…",
    subject: "Matière",
    class: "Classe",
    term: "Semestre",
    kind: "Type",
    sequence: "Numéro",
    sequenceHint:
      "Le combien de son type dans le semestre — 1 pour le premier.",
    scheduledOn: "Passé le",
    notScheduled: "Non daté",
    maxScore: "Noté sur",
    coefficient: "Poids",
    coefficientHint:
      "Poids dans la note de la matière pour le semestre — pas le coefficient de la matière elle-même.",
    teacher: "Enseignant",
    noTeacher: "Aucun enseignant affecté",
    notes: "Notes",
    progress: "Correction",
    average: "Moyenne",

    // ── Le générateur ───────────────────────────────────────────────────────
    generate: "Générer une série",
    generateTitle: "Générer une série de contrôles",
    generateHint:
      "Crée un contrôle par matière notée du programme de la classe. Relancer ne change rien — les matières qui ont déjà ce contrôle sont laissées telles quelles.",
    generated: "{count} contrôles créés, {skipped} existaient déjà.",
    noSubjectsChosen: "Cochez au moins une matière.",
    subjectsToGenerate: "Matières",
    subjectsToGenerateHint:
      "Décochez ce qui n'est pas évalué, et donnez à chaque contrôle sa propre date — une série s'étale sur une semaine, pas sur une matinée.",
    wholeSubjectHint:
      "Ce type se passe sur la matière entière — un seul contrôle pour اللغة العربية, et non un par composante. Cochez plutôt une composante pour n'évaluer qu'elle.",
    orOneComponent: "ou plutôt une seule de ses composantes",
    allSubjects: "Tout",
    noneSubjects: "Aucune",
    nothingToGenerate: "Toutes les matières ont déjà ce contrôle.",
    noTeacherAssigned:
      "Rien n'a été créé pour {subjects} — aucun enseignant n'y est affecté dans cette classe.",
    unstaffedSubjects:
      "{count} matière(s) ne peuvent pas être générées tant qu'aucun enseignant n'y est affecté.",
    noProgramme:
      "Cette classe n'a aucune matière notée à son programme — configurez-le d'abord.",
    termClosed:
      "Ce semestre est clôturé ; aucun contrôle ne peut y être ajouté.",

    // ── Un contrôle ─────────────────────────────────────────────────────────
    editAssessment: "Modifier le contrôle",
    saved: "Contrôle enregistré.",
    deleted: "Contrôle supprimé.",
    deleteTitle: "Supprimer ce contrôle ?",
    deleteBody: "« {name} » sera supprimé.",
    cannotDeleteMarked:
      "Ce contrôle porte des notes — annulez-le plutôt que de le supprimer.",
    maxScoreBelowMarks:
      "Des notes dépassent déjà ce total. Corrigez-les avant de le baisser.",
    statusChanged: "Statut mis à jour.",
    cannotUnpublish:
      "Des notes ont déjà été saisies — ce contrôle ne peut pas repasser en brouillon.",
    publish: "Publier",
    unpublish: "Repasser en brouillon",

    // ── La feuille de notes ─────────────────────────────────────────────────
    markSheet: "Feuille de notes",
    pupil: "Élève",
    score: "Note",
    absent: "Absent",
    excused: "Justifié",
    comment: "Appréciation",
    saveMarks: "Enregistrer les notes",
    marksSaved: "{count} notes enregistrées.",
    notPublished:
      "Ce contrôle n'est pas encore publié — publiez-le avant de saisir les notes.",
    scoreOutOfRange: "Les notes doivent être comprises entre 0 et {max}.",
    emptyRoster: "Aucun élève n'est affecté à cette classe.",
    markedOf: "{marked} notes sur {total}",
    pending: "Reste à corriger",
    passMarkIs: "Passage à {mark}/{max}.",
    passRate: "Taux de réussite",
    lowest: "Note la plus basse",
    highest: "Note la plus haute",
    absencesExcluded: "Les absences ne sont pas comptées dans la moyenne.",
    markAllAbsent: "Marquer le reste absent",
    clearMarks: "Effacer",

    // ── Synthèse ────────────────────────────────────────────────────────────
    awaitingMarks: "En attente de notes",
    awaitingMarksHint: "Contrôles publiés dont la correction n'est pas finie.",
    drafts: "Brouillons",
    draftsHint: "Prévus mais pas encore annoncés.",
    gradesEntered: "Notes saisies",
  },
  assessmentOptions: {
    statuses: {
      DRAFT: "Brouillon",
      PUBLISHED: "Publié",
      GRADED: "Corrigé",
      CANCELLED: "Annulé",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  assessments: "Contrôles",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    assessment: "Contrôles",
  },
  codes: {
    "assessment.view": "Consulter les contrôles et les notes",
    "assessment.manage": "Prévoir et générer les contrôles",
    "assessment.grade": "Saisir les notes",
    "assessment.publish": "Publier et retirer les contrôles",
    "assessment.delete": "Supprimer les contrôles",
  },
};

export default fr;
