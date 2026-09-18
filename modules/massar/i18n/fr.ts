/**
 * MASSAR translations (fr) — the default language.
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/fr.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * there is a compile error until this file supplies it.
 */
const fr = {
  massar: {
    title: "Notes MASSAR",
    subtitle:
      "Vérifier une feuille de notes NotesCC face à cet établissement, puis importer ses notes ou la remplir depuis les nôtres.",

    stepType: "1. Indiquez de quel type d'épreuve il s'agit",
    stepTypeHint:
      "Le contrôle est classé sous l'un de vos types d'évaluation. Il détermine le coefficient ; le fichier détermine le barème.",
    assessmentType: "Type d'épreuve",

    stepUpload: "2. Choisissez le fichier MASSAR",
    stepUploadHint:
      "Le .xlsx tel qu'il sort de MASSAR. Ne le réenregistrez pas depuis un autre logiciel — les clés masquées qu'il porte sont ce qui identifie la classe.",
    chooseFile: "Choisir un fichier",
    reading: "Lecture du classeur…",
    noFile: "Aucun fichier choisi.",

    stepReview: "3. Vérifiez, puis choisissez un sens",
    stepReviewHint: "Rien n'est écrit tant que vous n'en avez pas choisi un.",

    fileSays: "Le fichier indique",
    youHold: "Vous avez",
    schoolCode: "Établissement",
    className: "Classe",
    level: "Niveau",
    subject: "Matière",
    term: "Semestre",
    controle: "Contrôle",
    schoolYear: "Année",
    teacher: "Enseignant",
    scale: "Noté sur",
    pupilCount: "Élèves",
    massarId: "Identifiant de la feuille MASSAR",
    unmappedKeys: "Clés conservées, non rapprochées : {keys}",
    unmappedHint:
      "MASSAR les inscrit dans la feuille sans dire ce qu'elles sont. Elles sont conservées avec le fichier et jamais comparées.",
    notMapped: "non rattaché",
    notOnFile: "rien au dossier",

    checksTitle: "Contrôles",
    check: "Contrôle",
    expected: "Vous avez",
    found: "Le fichier indique",
    severity: "Résultat",
    allChecksPassed: "Tous les contrôles sont passés.",
    blockedBy:
      "Bloqué par {count} contrôle(s) en échec. Rien ne peut être écrit tant qu'ils ne sont pas corrigés.",

    severities: {
      OK: "Concorde",
      ADOPTABLE: "Pas encore rattaché",
      WARNING: "À savoir",
      ERROR: "Ne concorde pas",
    },

    checks: {
      FILE_SHAPE: "Forme du fichier",
      SCHOOL_CODE: "Code établissement",
      SCHOOL_YEAR: "Année scolaire",
      LEVEL: "Niveau",
      CLASS: "Classe",
      SUBJECT: "Matière",
      TERM: "Semestre",
      SEQUENCE: "Numéro du contrôle",
      MAX_SCORE: "Barème",
      TEACHER: "Enseignant",
      ASSESSMENT_EXISTS: "Contrôle au dossier",
      ASSESSMENT_IDENTITY: "Identifiant de la feuille MASSAR",
      ROSTER_SIZE: "Effectif de la classe",
      PUPIL_DUPLICATE: "Élève inscrit deux fois",
      PUPIL_UNKNOWN: "Élève inconnu de vos registres",
      PUPIL_NOT_IN_CLASS: "L'élève est dans une autre classe",
      PUPIL_NUMBER: "Numéro d'élève MASSAR",
      PUPIL_NAME: "Nom de l'élève",
      PUPIL_BIRTH_DATE: "Date de naissance",
      PUPIL_MISSING_FROM_FILE: "Absent du fichier",
      SCORE_RANGE: "Note hors barème",
      SCORE_MISSING: "Pas encore de note",
    },

    rowsTitle: "Élèves",
    line: "Ligne",
    cell: "Cellule",
    pupil: "Élève",
    massarCode: "Code MASSAR",
    score: "Note",
    absent: "Absent",
    comment: "Appréciation",
    problem: "Problème",
    matchedCount: "{count} rapproché(s)",
    rejectedCount: "{count} rejeté(s)",
    missingCount: "{count} sur la liste mais absent(s) du fichier",
    willAdoptNumber: "Son numéro MASSAR sera enregistré",
    showingFirst: "Affichage des {count} premiers sur {total}.",

    directionsTitle: "Que souhaitez-vous faire ?",

    generateTitle: "Créer le contrôle",
    generateHint:
      "Ouvre l'épreuve dont il s'agit et y appose l'identifiant MASSAR. Aucune note n'est écrite.",
    generate: "Créer le contrôle",

    importTitle: "Récupérer les notes",
    importHint:
      "Écrit les notes et appréciations du fichier sur le contrôle, en le créant s'il n'existe pas encore.",
    import: "Importer {count} notes",

    exportTitle: "Remplir la feuille depuis ici",
    exportHint:
      "Écrit vos notes dans ce même classeur et vous le rend, prêt à être déposé sur MASSAR. Le fichier conserve sa protection et ses clés masquées.",
    export: "Télécharger la feuille remplie",
    exported: "{count} notes écrites dans la feuille.",

    adoptTitle: "Adopter les codes MASSAR",
    adoptHint:
      "Enregistre les codes portés par ce fichier sur votre classe, votre matière, votre semestre et vos élèves, pour que la prochaine feuille se rapproche immédiatement. Ne remplit que ce qui est vide.",
    adopt: "Adopter les codes",

    working: "En cours…",

    controleCreated: "Le contrôle a été créé et porte l'identifiant MASSAR.",
    controleExisted:
      "Ce contrôle existait déjà ; l'identifiant MASSAR y a été enregistré.",
    imported: "{count} notes importées, {rejected} lignes rejetées.",
    adopted: "{fields} champ(s) rattaché(s), {pupils} numéro(s) d'élève MASSAR enregistré(s).",

    // ── La liste de classe (ListEleve) ────────────────────────────────────────
    roster: {
      title: "Liste de classe (ListEleve)",
      subtitle:
        "Chargez une liste de classe téléchargée depuis MASSAR — élèves, familles, classe et inscriptions avec leur échéancier — ou téléchargez-en une d'ici.",
      importTitle: "Importer une liste de classe",
      importHint:
        "Les élèves sont reconnus par leur code MASSAR. Rien n'est écrit avant votre confirmation ci-dessous.",
      chooseFile: "Choisir le fichier ListEleve",
      reading: "Lecture…",
      fileSchool: "Établissement",
      fileYear: "Année",
      fileLevel: "Niveau",
      fileClass: "Classe",
      filePupils: "Élèves",
      classWillBeCreated:
        "La classe « {value} » n'existe pas encore cette année et sera créée.",
      familiesTitle: "Familles à vérifier",
      familiesHint:
        "Le fichier ne contient aucun parent : les élèves qui portent le même nom sont regroupés dans une même famille. Séparez un groupe s'ils ne sont pas parents.",
      groupedPupils: "{count} élèves portent ce nom",
      attachedTo: "Rejoint la famille existante {code}",
      newHousehold: "Nouvelle famille",
      split: "Séparer",
      group: "Regrouper",
      confirm: "Importer {count} élèves",
      importing: "Importation…",
      imported:
        "{count} élèves importés, {families} familles ouvertes, {classes} classe(s) créée(s), {enrolled} inscriptions avec leur échéancier.",
      exportTitle: "Télécharger une liste de classe",
      exportHint:
        "Écrit une classe de l'année en cours au format ListEleve : code MASSAR, noms en arabe, sexe, date et lieu de naissance.",
      chooseClass: "Choisir une classe",
      exportAction: "Télécharger la liste",
      exporting: "Préparation…",
      exported: "{count} élèves écrits dans la liste.",
      errNoHeader:
        "Ce classeur n'est pas une liste de classe MASSAR — le tableau intitulé « الرمز » n'y figure pas.",
      errWrongYear:
        "Cette liste est celle de {file}, mais l'année scolaire sélectionnée est {current}. Changez d'année ou téléchargez la bonne liste.",
      errNoClass: "Choisissez d'abord une classe de cette année.",
    },

    errors: {
      emptyFile: "Aucun fichier, ou fichier trop volumineux.",
      notXlsx:
        "Ce n'est pas un classeur .xlsx. Retéléchargez la feuille depuis MASSAR et déposez-la sans l'ouvrir dans un autre logiciel.",
      noSheet: "Le classeur ne contient aucune feuille visible à lire.",
      noMarkers:
        "Ce classeur n'est pas une feuille de notes NotesCC — les repères masqués écrits par MASSAR n'y sont pas.",
      noPupils: "La feuille ne contient aucun élève.",
      blocked: "Certains contrôles ont échoué. Corrigez-les, puis redéposez le fichier.",
      noRows: "Aucun élève du fichier n'a pu être rapproché de cette classe.",
      noType: "Ce type d'épreuve n'existe pas dans cet établissement.",
      locked:
        "Ce contrôle n'accepte pas de notes — il est encore au brouillon, ou il a été annulé.",
      outOfRange: "Une note du fichier se situe hors du barème de l'épreuve.",
      assessmentNotFound: "Ce contrôle ne figure pas dans les registres de cet établissement.",
      nothingToAdopt: "Il n'y avait plus rien à adopter — tout est déjà rattaché.",
    },
  },
} as const;

export const nav = {
  massar: "MASSAR",
} as const;

export const permissions = {
  groups: {
    massar: "MASSAR",
  },
  codes: {
    "massar.reconcile": "Vérifier un fichier MASSAR face à l'établissement",
    "massar.import": "Importer les notes depuis MASSAR",
    "massar.export": "Remplir une feuille MASSAR depuis nos notes",
    "massar.map": "Adopter les codes MASSAR sur les classes et les élèves",
  },
} as const;

export default fr;
