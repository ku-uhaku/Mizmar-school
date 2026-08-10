/**
 * Bulletins translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  bulletin: {
    title: "Report cards",
    subtitle: "What a term's marks add up to, agreed by the council and issued.",

    // ── Choosing what to work on ────────────────────────────────────────────
    class: "Class",
    term: "Term",
    pickClass: "Choose a class…",
    pickTerm: "Choose a term…",
    pickBoth: "Choose a class and a term to begin.",
    pickBothHint:
      "Report cards are worked out for a whole class at once — a rank means nothing on its own.",

    // ── Computing ───────────────────────────────────────────────────────────
    compute: "Work out the results",
    recompute: "Work them out again",
    computeHint:
      "Reads every validated mark of the term and fills in the averages, the ranks and the register. Appreciations and decisions already written are left alone.",
    computed: "{count} report cards worked out.",
    computedWithSkipped:
      "{count} worked out. {skipped} already published and left untouched.",
    computedOn: "Worked out on {date}",
    noRoster: "This class has no pupils enrolled for that term.",
    noProgramme:
      "No marked subject is declared for this level. Set the programme under Configuration → Academics first.",
    termMismatch: "That term belongs to another school year.",

    // ── Publishing ──────────────────────────────────────────────────────────
    publish: "Issue to families",
    publishHint:
      "Issues the whole class at once, and freezes every figure. A published report card cannot be worked out again until it is withdrawn.",
    published: "{count} report cards issued.",
    withdraw: "Withdraw",
    withdrawHint: "Takes them back from families so they can be corrected.",
    withdrawn: "{count} report cards withdrawn.",
    nothingToPublish: "Nothing to issue — work out the results first.",
    publishedLocked:
      "This report card has been issued. Withdraw it before changing anything.",
    publishedOn: "Issued on {date}",

    // ── The council's table ─────────────────────────────────────────────────
    council: "Class council",
    councilHint:
      "One line per pupil. The mention is suggested from the average and awarded by the council.",
    pupil: "Pupil",
    generalAverage: "General average",
    yearAverage: "Year average",
    rank: "Rank",
    rankOf: "{rank} of {size}",
    classSize: "Pupils",
    classAverage: "Class average",
    classLowest: "Lowest",
    classHighest: "Highest",
    mention: "Mention",
    suggested: "Suggested: {mention}",
    noMention: "No mention",
    decision: "End-of-year decision",
    decisionHint:
      "Asked on the last term only — this is what the pupil's year comes to.",
    noDecision: "Not decided",
    councilComment: "The council's note",
    mainTeacherComment: "The class teacher's note",

    // ── One report card ─────────────────────────────────────────────────────
    subject: "Subject",
    coefficient: "Coef.",
    average: "Average",
    marks: "Marks",
    appreciation: "Appreciation",
    appreciationHint: "One or two lines about this pupil in your subject.",
    noMark: "—",
    absences: "Absences",
    unjustifiedAbsences: "Unjustified",
    lates: "Lates",
    attendance: "Attendance",
    outOf: "out of {max}",

    // ── States and results ──────────────────────────────────────────────────
    noBulletins: "No report card for this class and term yet.",
    noBulletinsHint: "Work out the results and they will appear here.",
    noneForPupil: "No report card has been issued for this pupil yet.",
    saved: "Saved.",
    print: "Print",
    printClass: "Print the whole class",
    reportCard: "Report card",
    termResults: "Results by term",
  },
  bulletinOptions: {
    statuses: {
      DRAFT: "Draft",
      PUBLISHED: "Issued",
    },
    mentions: {
      FELICITATIONS: "Congratulations",
      ENCOURAGEMENTS: "Encouragement",
      TABLEAU_HONNEUR: "Honour roll",
      AVERTISSEMENT: "Warning",
    },
    decisions: {
      ADMITTED: "Moves up",
      ADMITTED_CONDITIONAL: "Moves up, with conditions",
      REPEATING: "Repeats the year",
      REORIENTED: "Reoriented",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  bulletins: "Report cards",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    bulletin: "Report cards",
  },
  codes: {
    "bulletin.view": "View report cards",
    "bulletin.compute": "Work out a class's results",
    "bulletin.appreciate": "Write subject appreciations",
    "bulletin.council": "Award mentions and decide the year",
    "bulletin.publish": "Issue report cards to families",
  },
} as const;

export default en;
