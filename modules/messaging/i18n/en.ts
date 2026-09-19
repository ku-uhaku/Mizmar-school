/**
 * Messaging translations (en). Canonical — the `Dictionary` type is derived
 * from this file, so a key added here is a compile error until `fr` and `ar`
 * supply it.
 */
const en = {
  messaging: {
    title: "Payment reminders",
    subtitle: "Send a WhatsApp reminder to the parents of families who are late.",
    backToCaisse: "Cash desk",

    gateway: {
      READY: "Connected",
      DISCONNECTED: "Disconnected — pair the phone, then resume",
      UNCONFIGURED: "Not set up on this server",
    },

    credits: {
      label: "Message credits",
      left: "{count} left",
      // Shown when the balance is short: the school cannot buy credits itself.
      contactOwner:
        "Not enough credits. Contact the platform owner to buy more — one credit is one message.",
      manage: "Manage credits",
    },

    filters: {
      title: "Who",
      minAmount: "Overdue at least",
      level: "Level",
      class: "Class",
      allLevels: "All levels",
      allClasses: "All classes",
      search: "Search family or parent",
    },

    columns: {
      family: "Family",
      contact: "Parent",
      phone: "Phone",
      overdue: "Overdue",
      status: "Status",
    },

    skip: {
      NO_PHONE: "No valid mobile number",
      COOL_DOWN: "Messaged recently",
    },
    willSend: "Will be messaged",
    noneLate: "No family is behind on payments.",

    selection: {
      leftOut: "Left out",
      skipped: "{count} skipped",
      summary: "{count} will be messaged · {skipped} skipped",
      exclude: "Leave out",
      include: "Include",
    },

    compose: {
      title: "The message",
      template: "Message",
      variablesHint:
        "Variables: {parent} {famille} {montant} {enfants} {ecole} {remarque}",
      remark: "Remark",
      remarkHint: "Free text, inserted where you write {remarque}.",
      preview: "Preview",
      previewFor: "For {family}",
      unknownVariables: "Not a variable: {names}",
      defaultTemplate:
        "Dear {parent}, our records show an overdue school payment of {montant} for {enfants}. {remarque} Thank you, {ecole}.",
    },

    print: "Print",
    send: "Send",
    sendConfirm:
      "Send {count} messages? This uses {count} credits; credits for messages that fail are given back.",
    sending: "Queueing…",
    queued: "{count} messages queued. They are sent in the background.",
    cancelled: "Campaign cancelled. {count} credits given back.",
    cancel: "Cancel",
    resume: "Resume",
    activeCampaign: "A campaign is in progress",
    viewCampaign: "View progress",

    campaigns: {
      title: "Sent",
      empty: "Nothing has been sent yet.",
      recipients: "Recipients",
      sent: "Sent",
      failed: "Failed",
      pending: "Waiting",
      cancelled: "Cancelled",
      back: "Reminders",
    },

    creditsPage: {
      title: "Message credits",
      subtitle: "Owner only. One credit is one message.",
      balance: "Balance",
      amount: "Credits to add",
      note: "Note (what was bought)",
      submit: "Add credits",
      ledger: "History",
      emptyLedger: "No movement yet.",
    },
    toppedUp: "Credits added. Balance: {balance}.",

    gatewayLabel: "WhatsApp",
    campaignStatus: {
      QUEUED: "Queued",
      RUNNING: "Sending",
      PAUSED: "Paused — WhatsApp disconnected",
      DONE: "Done",
      CANCELLED: "Cancelled",
    },
    deliveryStatus: {
      PENDING: "Waiting",
      SENDING: "Sending",
      SENT: "Sent",
      FAILED: "Failed, credit returned",
      CANCELLED: "Cancelled",
    },
    creditReasons: {
      TOPUP: "Top-up",
      RESERVE: "Reserved for a campaign",
      REFUND: "Refunded",
      ADJUST: "Adjustment",
    },

    errors: {
      templateInvalid: "Write a message of at most 1,000 characters.",
      notConfigured: "WhatsApp is not set up on this server.",
      noRecipients: "Nobody to message with these filters.",
      insufficientCredits:
        "Not enough credits: {available} available, {needed} needed. Contact the platform owner to buy more.",
      campaignInProgress:
        "A campaign is already in progress for this school. Wait for it to finish or cancel it.",
      amountInvalid: "Enter a whole number of credits above zero.",
    },
  },
} as const;

export const nav = {
  reminders: "Reminders",
};

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    messaging: "WhatsApp reminders",
  },
  codes: {
    "messaging.send": "Send WhatsApp reminders",
  },
} as const;

export default en;
