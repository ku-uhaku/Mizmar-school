/**
 * Students translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  student: {
    title: "Élèves",
    subtitle: "Tous les enfants inscrits sur les registres de l'école.",
    newStudent: "Nouvel élève",
    editStudent: "Modifier l'élève",
    createStudent: "Créer l'élève",
    identity: "Identité",
    identityHint:
      "Qui est l'enfant. Sa place est définie par l'inscription.",
    code: "Matricule",
    codeHint: "Laisser vide pour attribuer le suivant, ex. E-2025-0431.",
    massarCode: "Code MASSAR",
    massarCodeHint: "Le code de l'élève dans le système du ministère.",
    firstName: "Prénom",
    lastName: "Nom",
    firstNameAr: "Prénom (arabe)",
    lastNameAr: "Nom (arabe)",
    gender: "Sexe",
    birthDate: "Date de naissance",
    birthDateHint: "Détermine le niveau auquel l'enfant peut être admis.",
    birthPlace: "Lieu de naissance",
    birthPlaceAr: "Lieu de naissance (arabe)",
    nationality: "Nationalité",
    nationalId: "CNIE",
    nationalIdHint: "Pour les élèves en âge d'en posséder une.",
    photoUrl: "URL de la photo",
    age: "Âge",
    entryDate: "Arrivée à l'école",
    exitDate: "Départ le",
    medical: "Santé",
    medicalNotes: "Informations médicales",
    medicalNotesHint:
      "Allergies et traitements que l'infirmerie doit connaître.",
    notes: "Remarques",
    family: "Famille",
    familyHint: "Le dossier familial auquel cet enfant est rattaché.",
    noFamily: "Pas encore rattaché à une famille.",
    attachHint:
      "Rattachez l'enfant à un dossier familial pour enregistrer ses tuteurs.",
    attachFamily: "Rattacher à une famille",
    detachFamily: "Détacher de la famille",
    viewFamily: "Ouvrir le dossier familial",
    created: "Dossier élève ouvert.",
    updated: "Élève mis à jour.",
    deleted: "Élève supprimé.",
    codeTaken: "Ce matricule est déjà utilisé.",
    massarTaken: "Ce code MASSAR est déjà attribué à un autre élève.",
    hasEnrolments:
      "Cet élève a des inscriptions — désactivez le dossier à la place.",
    deleteTitle: "Supprimer ce dossier élève ?",
    deleteBody: "« {name} » sera supprimé.",
    noStudents: "Aucun élève.",
    searchPlaceholder: "Rechercher par nom, matricule ou code MASSAR…",
    studentColumn: "Élève",
    placement: "Affectation",
    notPlaced: "Non affecté",
    notEnrolled: "Non inscrit",
    tabInformation: "Informations",
    tabFamily: "Famille",
    tabEnrolment: "Inscription",
    tabFees: "Frais",
    tabTimetable: "Emploi du temps",
    workflow: "Parcours",
    workflowHint: "Où en est ce dossier.",
    nextStep: "Suivant : {step}",
    workflowComplete: "Ce dossier est complet.",
    steps: {
      FILE: "Dossier ouvert",
      FAMILY: "Famille rattachée",
      ENROLMENT: "Inscrit",
      CLASS: "Classe affectée",
      FEES: "Échéancier généré",
    },
  },
  studentOptions: {
    genders: {
      MALE: "Masculin",
      FEMALE: "Féminin",
    },
    statuses: {
      PRE_REGISTERED: "Préinscrit",
      ENROLLED: "Inscrit",
      TRANSFERRED: "Transféré",
      WITHDRAWN: "Radié",
      GRADUATED: "Diplômé",
    },
  },
};

export const nav = {
  students: "Élèves",
};

export const permissions = {
  groups: {
    student: "Élèves",
  },
  codes: {
    "student.view": "Consulter les élèves",
    "student.create": "Ouvrir des dossiers élèves",
    "student.update": "Modifier les dossiers élèves",
    "student.delete": "Supprimer des dossiers élèves",
  },
};

export default fr;
