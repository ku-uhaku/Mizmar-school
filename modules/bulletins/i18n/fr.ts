/**
 * Bulletins translations (fr). Same shape as `en.ts`, which is canonical — a key
 * added there is a compile error here until it is supplied.
 */
const fr = {
  bulletin: {
    title: "Bulletins",
    subtitle:
      "Ce que les notes d'un semestre donnent, arrêté en conseil et remis aux familles.",

    class: "Classe",
    term: "Semestre",
    pickClass: "Choisir une classe…",
    pickTerm: "Choisir un semestre…",
    pickBoth: "Choisissez une classe et un semestre pour commencer.",
    pickBothHint:
      "Les bulletins se calculent par classe entière — un rang n'a aucun sens isolément.",

    compute: "Calculer les résultats",
    recompute: "Recalculer",
    computeHint:
      "Reprend toutes les notes validées du semestre et renseigne les moyennes, les rangs et l'assiduité. Les appréciations et les décisions déjà saisies ne sont pas touchées.",
    computed: "{count} bulletins calculés.",
    computedWithSkipped:
      "{count} calculés. {skipped} déjà publiés et laissés intacts.",
    computedOn: "Calculé le {date}",
    noRoster: "Aucun élève inscrit dans cette classe pour ce semestre.",
    noProgramme:
      "Aucune matière notée n'est déclarée pour ce niveau. Renseignez d'abord le programme dans Configuration → Scolarité.",
    termMismatch: "Ce semestre appartient à une autre année scolaire.",

    publish: "Publier aux familles",
    publishHint:
      "Publie la classe entière d'un coup et fige tous les chiffres. Un bulletin publié ne peut plus être recalculé tant qu'il n'est pas retiré.",
    published: "{count} bulletins publiés.",
    withdraw: "Retirer",
    withdrawHint: "Les retire aux familles pour pouvoir les corriger.",
    withdrawn: "{count} bulletins retirés.",
    nothingToPublish: "Rien à publier — calculez d'abord les résultats.",
    publishedLocked:
      "Ce bulletin est publié. Retirez-le avant de modifier quoi que ce soit.",
    publishedOn: "Publié le {date}",

    council: "Conseil de classe",
    councilHint:
      "Une ligne par élève. La mention est proposée d'après la moyenne et décernée par le conseil.",
    pupil: "Élève",
    generalAverage: "Moyenne générale",
    yearAverage: "Moyenne annuelle",
    rank: "Rang",
    rankOf: "{rank} sur {size}",
    classSize: "Élèves",
    classAverage: "Moyenne de classe",
    classLowest: "Plus basse",
    classHighest: "Plus haute",
    mention: "Mention",
    suggested: "Proposée : {mention}",
    noMention: "Sans mention",
    decision: "Décision de fin d'année",
    decisionHint:
      "Demandée au dernier semestre seulement — c'est ce que devient l'année de l'élève.",
    noDecision: "Non décidée",
    councilComment: "Observation du conseil",
    mainTeacherComment: "Observation du professeur principal",

    subject: "Matière",
    coefficient: "Coef.",
    average: "Moyenne",
    marks: "Notes",
    appreciation: "Appréciation",
    appreciationHint: "Une ou deux lignes sur cet élève dans votre matière.",
    noMark: "—",
    absences: "Absences",
    unjustifiedAbsences: "Non justifiées",
    lates: "Retards",
    attendance: "Assiduité",
    outOf: "sur {max}",

    noBulletins: "Aucun bulletin pour cette classe et ce semestre.",
    noBulletinsHint: "Calculez les résultats et ils apparaîtront ici.",
    noneForPupil: "Aucun bulletin n'a encore été publié pour cet élève.",
    saved: "Enregistré.",
    print: "Imprimer",
    printClass: "Imprimer toute la classe",
    reportCard: "Bulletin de notes",
    termResults: "Résultats par semestre",
  },
  bulletinOptions: {
    statuses: {
      DRAFT: "Brouillon",
      PUBLISHED: "Publié",
    },
    mentions: {
      FELICITATIONS: "Félicitations",
      ENCOURAGEMENTS: "Encouragements",
      TABLEAU_HONNEUR: "Tableau d'honneur",
      AVERTISSEMENT: "Avertissement",
    },
    decisions: {
      ADMITTED: "Admis en classe supérieure",
      ADMITTED_CONDITIONAL: "Admis sous conditions",
      REPEATING: "Redouble",
      REORIENTED: "Réorienté",
    },
  },
} as const;

export const nav = {
  bulletins: "Bulletins",
} as const;

export const permissions = {
  groups: {
    bulletin: "Bulletins",
  },
  codes: {
    "bulletin.view": "Consulter les bulletins",
    "bulletin.compute": "Calculer les résultats d'une classe",
    "bulletin.appreciate": "Saisir les appréciations par matière",
    "bulletin.council": "Décerner les mentions et décider de l'année",
    "bulletin.publish": "Publier les bulletins aux familles",
  },
} as const;

export default fr;
