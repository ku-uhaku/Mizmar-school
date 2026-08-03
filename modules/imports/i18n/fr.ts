/**
 * Imports translations (fr). Checked against `en` — see lib/i18n/types.ts.
 *
 * `columns` est le format du fichier, pas seulement l'intitulé d'un écran : ces
 * chaînes sont écrites en en-tête du fichier modèle et reconnues à l'import.
 */
const fr = {
  imports: {
    title: "Importer des élèves",
    subtitle:
      "Chargez une liste d'élèves depuis un tableur. Les familles et les parents sont créés avec eux.",

    stepTemplate: "1. Prenez le fichier modèle",
    stepTemplateHint:
      "Il porte les intitulés attendus et une ligne d'exemple. Remplissez-le dans Excel, puis supprimez l'exemple.",
    downloadTemplate: "Télécharger le fichier modèle",

    stepUpload: "2. Choisissez votre fichier",
    stepUploadHint:
      "CSV, points-virgules ou virgules — au choix de votre Excel. Les colonnes en trop sont ignorées : un fichier plus riche passe très bien.",
    chooseFile: "Choisir un fichier",
    reading: "Lecture du fichier…",

    stepReview: "3. Vérifiez, puis confirmez",
    stepReviewHint: "Rien n'est enregistré tant que vous n'avez pas confirmé.",

    willCreate: "{count} à créer",
    willSkip: "{count} déjà au fichier",
    willReject: "{count} refusées",
    newFamilies: "{count} dossiers ouverts",
    ignoredColumns: "Colonnes ignorées : {columns}",
    missingColumns:
      "Il manque une colonne obligatoire : {columns}. Prenez le fichier modèle et recopiez-y vos données.",
    line: "Ligne",
    outcome: "Résultat",
    pupil: "Élève",
    outcomeCreate: "Créer",
    outcomeSkip: "Ignorer",
    outcomeReject: "Refusée",
    problem: "Problème",
    attachedTo: "Rejoint le dossier {code}",
    showingFirst: "Affichage des {count} premières lignes sur {total}.",
    allGood: "Toutes les lignes peuvent être importées.",

    confirm: "Importer {count} élèves",
    importing: "Import en cours…",
    imported: "{count} élèves importés, {families} dossiers ouverts.",
    enrolled: "{count} élèves importés, {families} dossiers ouverts, {enrolled} inscriptions avec leur échéancier.",
    willEnrol: "{count} inscriptions",

    exportTitle: "Exporter les élèves",
    exportHint:
      "Tous les élèves avec leur dossier et leurs parents, dans le format même que cet écran importe — un fichier sorti peut donc être réinjecté.",
    exportAction: "Exporter vers Excel",
    exporting: "Préparation…",
    exported: "{count} lignes exportées.",
    exportEmpty: "Aucun élève à exporter pour l'instant.",

    errors: {
      emptyFile: "Ce fichier est vide.",
      fileTooLarge:
        "Ce fichier est trop volumineux. Coupez-le et importez en deux fois.",
      notCsv:
        "Enregistrez le fichier au format CSV depuis Excel, puis choisissez-le à nouveau.",
      nothingToImport: "Rien dans ce fichier n'a pu être importé.",
      requiredColumn: "{column} est obligatoire.",
      badDate:
        "{column} : « {value} » n'est pas une date lisible par l'import. Écrivez-la 15/09/2012.",
      badGender:
        "« {value} » n'est pas un sexe lisible par l'import. Écrivez F ou M.",
      alreadyOnFile: "Déjà au fichier sous {name} ({code}).",
      duplicateInFile: "Même élève qu'à la ligne {line} de ce fichier.",
      unknownLevel: "Le niveau « {value} » n'est pas ouvert cette année. Niveaux ouverts : {available}.",
      unknownClass: "La classe « {value} » n'existe pas en {level}. Classes : {available}.",
      unknownRoute: "La ligne « {value} » n'existe pas. Lignes : {available}.",
      unknownStop: "L'arrêt « {value} » n'est pas sur la ligne {route}. Arrêts : {available}.",
      noSchoolYear: "Choisissez une année scolaire avant d'importer des inscriptions.",
      alreadyEnrolled: "Déjà inscrit cette année.",
    },

    columns: {
      code: "Matricule",
      massarCode: "MASSAR",
      lastName: "Nom",
      firstName: "Prénom",
      lastNameAr: "النسب",
      firstNameAr: "الاسم",
      gender: "Sexe",
      birthDate: "Date de naissance",
      nationality: "Nationalité",
      neighbourhood: "Quartier",
      familyName: "Famille",
      familyPhone: "Téléphone famille",
      familyEmail: "Email famille",
      addressLine: "Adresse",
      city: "Ville",
      fatherLastName: "Père — nom",
      fatherFirstName: "Père — prénom",
      fatherNationalId: "Père — CIN",
      fatherPhone: "Père — téléphone",
      fatherProfession: "Père — profession",
      motherLastName: "Mère — nom",
      motherFirstName: "Mère — prénom",
      motherNationalId: "Mère — CIN",
      motherPhone: "Mère — téléphone",
      motherProfession: "Mère — profession",
      levelCode: "Niveau",
      trackCode: "Filière",
      className: "Classe",
      enrolledOn: "Date d'inscription",
      isRepeating: "Redoublant",
      usesTransport: "Transport",
      routeName: "Ligne",
      stopName: "Arrêt",
      usesCanteen: "Cantine",
    },
  },
};

export const permissions = {
  groups: {
    import: "Chargement en masse",
  },
  codes: {
    "import.students": "Importer des élèves depuis un tableur",
  },
} as const;

export default fr;
