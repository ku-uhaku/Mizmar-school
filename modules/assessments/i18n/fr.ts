/**
 * Assessments translations (fr).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * there is a compile error until this file supplies it.
 */
const fr = {
  assessment: {
    validationQueue: "En attente de votre validation",
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
    sequenceLabel: "n° {sequence}",
    massarCode: "Code MASSAR",
    massarCodeHint:
      "L'identifiant du E5 masqué de la feuille. Laisser vide pour que le prochain import NotesCC s'approprie lui-même ce contrôle — un code qui n'est pas celui de la feuille bloquera cet import.",
    massarPaired: "Apparié à une feuille",
    massarAdoptable: "Appropriable",
    massarCodeTaken: "« {title} » répond déjà de cette feuille.",
    massarCodeCleared: "Dissocié — le prochain import pourra s'approprier ce contrôle.",
    generateNoClasses: "Aucune classe n'est ouverte cette année.",
    generateNoTypes:
      "Aucun type d'évaluation n'est configuré — ajoutez-en un sous Configuration.",
    generateNoOpenTerm:
      "Tous les semestres de l'année sont clos. Rouvrez-en un pour y programmer des contrôles.",
    scheduledOn: "Passé le",
    notScheduled: "Non daté",
    maxScore: "Noté sur",
    coefficient: "Poids",
    coefficientHint:
      "Poids dans la note de la matière pour le semestre — pas le coefficient de la matière elle-même.",
    teacher: "Enseignant",
    noTeacher: "Aucun enseignant affecté",
    notes: "Notes",
    covers: "Ce qui est évalué",
    coversHint: "La leçon ou les pages, comme annoncé à la classe — « leçon 3, p.42 ».",
    coversPlaceholder: "Leçon, chapitre, pages…",
    progress: "Correction",
    average: "Moyenne",
    stage: "Étape",

    // ── Le suivi des devoirs ────────────────────────────────────────────────
    devoirsReview: "Suivi des devoirs",
    devoirsReviewHint:
      "Les devoirs donnés par les enseignants dans toute l'école, et ce qui attend d'être validé.",
    noDevoirs: "Aucun enseignant n'a encore donné de devoir cette année.",
    noDevoirsHint:
      "Les devoirs sont créés par les enseignants depuis l'espace enseignant, ou ici par l'administration, et apparaissent dans cette liste dans les deux cas.",

    // ── Donner un devoir depuis l'administration ────────────────────────────
    setDevoir: "Donner un devoir",
    setDevoirTitle: "Donner un devoir",
    setDevoirHint:
      "Un devoir pour une classe — pour un collègue absent, ou qui l'a annoncé à la classe sans le saisir.",
    setDevoirDraftHint:
      "Enregistré en brouillon. C'est la publication qui ouvre la feuille de notes et prévient les familles.",
    setDevoirNoTeaching:
      "Aucune classe n'a encore d'affectation cette année — affectez d'abord un enseignant à une matière.",
    setDevoirNoKinds:
      "Aucun type de travail n'est ouvert aux enseignants. Ouvrez-en un dans la configuration.",
    classAndSubject: "Classe et matière",
    classAndSubjectHint:
      "Le couple sur lequel un enseignant est affecté. Le devoir revient à celui qui occupe le poste, pas à celui qui le saisit.",
    paperTitle: "Intitulé",
    devoirTitlePlaceholder: "Exercices p.42",

    // ── S'il pèse sur la période ────────────────────────────────────────────
    countsTowardAverage: "Compte dans la moyenne",
    countsTowardAverageHint:
      "Décochez pour une révision, un blanc, ou un travail noté seulement pour situer l'élève. Il reste corrigé et reste visible — il ne déplace simplement jamais la moyenne de la matière.",
    doesNotCount: "Hors moyenne",
    makeCount: "Le compter",
    makeNotCount: "Hors moyenne",
    nowCounts: "Ce devoir compte désormais dans la moyenne.",
    nowDoesNotCount: "Ce devoir ne compte plus dans la moyenne.",
    uncountedNeedsNoMarks:
      "Il ne pèse pas sur la période : il peut être clôturé sans aucune note.",
    showingFirst:
      "Les {count} plus récents. Affinez les filtres pour voir le reste.",
    allTeachers: "Tous les enseignants",
    allClasses: "Toutes les classes",

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

    // ── La remise des notes ─────────────────────────────────────────────────
    submitMarks: "Remettre les notes",
    takeBack: "Reprendre",
    acceptMarks: "Valider les notes",
    reopen: "Rouvrir",
    awaitingValidation:
      "Remis. La direction doit encore valider ces notes.",
    awaitingYourValidation:
      "L'enseignant a remis sa correction — validez-la pour rendre les notes définitives.",
    cannotValidateIncomplete:
      "Des élèves n'ont ni note ni absence. Terminez la feuille avant de la valider.",

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

    // ── Le barème des appréciations ─────────────────────────────────────────
    scaleTitle: "Appréciations",
    scaleSubtitle:
      "Le mot porté à côté de la note, et le seuil à partir duquel il s'applique.",
    scaleHelp:
      "Un palier va de son propre seuil jusqu'au suivant. Les seuils s'expriment en pourcentage du barème de l'épreuve : la même échelle sert un oral sur 10 et un contrôle sur 20.",
    scaleEmpty: "Aucun barème. Les notes se saisissent sans appréciation proposée.",
    scaleFrom: "À partir de",
    scaleCovers: "Sur 20",
    scaleLabel: "Appréciation",
    scaleLabelAr: "Appréciation (arabe)",
    scaleColour: "Couleur",
    scaleActive: "Utilisé",
    scaleAdd: "Ajouter un palier",
    scaleReset: "Rétablir le barème usuel",
    scaleRemove: "Supprimer ce palier",
    scaleSave: "Enregistrer le barème",
    scaleSaved: "Barème enregistré.",
    scaleDuplicateFloor: "Deux paliers partent du même seuil.",
    scaleTooMany: "Un barème compte au plus {max} paliers.",
    scaleNoBottom:
      "Aucun palier ne part de 0 %, les notes les plus basses n'auront donc pas d'appréciation proposée.",
    scaleExample: "Une note de {mark}/{max} donnerait : {label}",

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
      SUBMITTED: "Remis",
      GRADED: "Corrigé",
      CANCELLED: "Annulé",
    },
    /** À qui de jouer — voir `ASSESSMENT_STAGES`. */
    stages: {
      ALL: "Tous",
      TO_PUBLISH: "À ouvrir",
      MARKING: "En saisie",
      TO_VALIDATE: "À valider",
      DONE: "Validés",
    },
  },
};

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  assessments: "Contrôles",
  devoirs: "Devoirs",
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
    "assessment.scale": "Modifier le barème des appréciations",
  },
};

export default fr;
