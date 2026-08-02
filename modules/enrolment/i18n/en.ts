/**
 * Enrolment translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  enrolment: {
    title: "Enrolment",
    subtitle: "The pupil's place for {year} — level, class and fees.",
    enrol: "Enrol",
    enrolTitle: "Enrol this pupil",
    notEnrolled: "Not enrolled for this year.",
    notEnrolledHint:
      "Enrolling sets the level and writes the whole year's fee schedule.",
    level: "Level",
    levelHint: "The levels this school opened this year.",
    track: "Stream",
    schoolClass: "Class",
    classHint: "May be left until September — the place is real without it.",
    group: "Group",
    groupHint: "For the subjects taught in halves.",
    noClass: "No class yet",
    noGroup: "No group",
    status: "Status",
    enrolledOn: "Enrolled on",
    leftOn: "Left on",
    isRepeating: "Repeating the year",
    options: "Options",
    usesTransport: "School bus",
    usesCanteen: "Canteen",
    optionsHint: "Optional charges are billed only to those who subscribe.",
    optionStartsOn: "Billed from",
    optionStartsWithYear: "The start of the year",
    optionStartsOnHint:
      "Instalments before this month are not raised, so a family joining mid-year pays only for the months they use.",
    notes: "Notes",
    capacity: "{enrolled} / {capacity}",
    seatsLeft: "{count} seats left",
    full: "Full",
    enrolled: "Pupil enrolled.",
    enrolledWithFees: "Pupil enrolled and the year's fees scheduled.",
    updated: "Enrolment updated.",
    updatedWithFees:
      "Enrolment updated · {added} fee lines added, {removed} withdrawn.",
    deleted: "Enrolment deleted.",
    alreadyEnrolled: "This pupil is already enrolled for this year.",
    levelLockedByPayment:
      "This pupil's level cannot be changed: {count} receipt(s) totalling {amount} DH have already been allocated against their fee schedule. Cancel them, or re-enrol the pupil.",
    levelLocked: "Locked by a payment",
    levelChangedRepriced:
      "Level changed and the fee schedule re-priced \u2014 {count} lines.",
    offeringUnavailable: "That level is not open this year.",
    classUnavailable: "That class does not belong to this year.",
    classAssigned: "Class assigned.",
    classCleared: "Pupil taken out of the class.",
    deleteTitle: "Delete this enrolment?",
    deleteBody: "The whole year's fee schedule will go with it.",

    fees: "Fees",
    feesSubtitle: "What this family owes for the year, month by month.",
    feesEmpty: "No fee schedule yet.",
    feesEmptyHint:
      "The schedule is written at enrolment from the year's price list.",
    generateFees: "Generate schedule",
    rebuildFees: "Rebuild from price list",
    rebuildTitle: "Rebuild the fee schedule?",
    rebuildBody: "Amounts changed by hand on this schedule will be lost.",
    feesGenerated: "Fee schedule written.",
    feesUnchanged: "Nothing to add — the schedule is already complete.",
    feeUpdated: "Fee line updated.",
    applyToFollowing: "Apply to the following months too",
    applyToFollowingHint:
      "Copies this reduction onto the {count} later instalments of this charge. Each month keeps its own amount.",
    feeUpdatedCarried: "Fee line updated, and carried to {count} later months.",
    legendClick: "Click a cell to change its amount or reduction",
    legendReduced: "Reduced",
    legendNotDue: "Waived or cancelled",
    editFee: "Edit this charge",
    editFeeHint: "The amount and the reduction for one month.",
    baseAmount: "Amount before reduction",
    discount: "Reduction",
    discountPercent: "Percentage",
    discountAmount: "Flat amount",
    discountRule: "Reduction offered",
    discountRuleHint: "Which of the year's reductions this is granted under.",
    discountTooLarge: "The reduction is larger than the charge.",
    netAmount: "Payable",
    feeStatus: "Status",
    dueOn: "Due {date}",
    instalment: "Instalment {index}",
    monthTotal: "Month total",
    rowTotal: "Total",
    grandTotal: "Total for the year",
    beforeDiscount: "Before reductions",
    totalDiscount: "Reductions granted",
    noCharge: "—",
    feeType: "Charge",
  },
  enrolmentOptions: {
    statuses: {
      PENDING: "Pending",
      ACTIVE: "Active",
      TRANSFERRED: "Transferred",
      WITHDRAWN: "Withdrawn",
      COMPLETED: "Completed",
    },
    lineStatuses: {
      DUE: "Due",
      WAIVED: "Waived",
      CANCELLED: "Cancelled",
    },
    months: {
      "1": "Jan",
      "2": "Feb",
      "3": "Mar",
      "4": "Apr",
      "5": "May",
      "6": "Jun",
      "7": "Jul",
      "8": "Aug",
      "9": "Sep",
      "10": "Oct",
      "11": "Nov",
      "12": "Dec",
    },
  },
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    enrolment: "Enrolment",
  },
  codes: {
    "enrolment.view": "View enrolments",
    "enrolment.create": "Enrol pupils",
    "enrolment.update": "Update enrolments and class placement",
    "enrolment.delete": "Delete enrolments",
    "enrolment.fees": "Manage fee schedules and reductions",
  },
} as const;

export default en;
