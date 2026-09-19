/**
 * Allowed values for the messaging module's enum-like columns. Pure data.
 * The labels live in i18n/{en,fr,ar}.ts under `messaging`.
 */

/** MessageCampaign.kind. Only the finance reminder exists for now. */
export const CAMPAIGN_KINDS = ["PAYMENT_REMINDER"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

/** MessageCampaign.status. PAUSED: the WhatsApp session dropped mid-send. */
export const CAMPAIGN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "PAUSED",
  "DONE",
  "CANCELLED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** MessageDelivery.status. */
export const DELIVERY_STATUSES = [
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED",
  "CANCELLED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** CreditLedger.reason. */
export const CREDIT_REASONS = ["TOPUP", "RESERVE", "REFUND", "ADJUST"] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

/** The variables a template may use. `remarque` is the manager's free note. */
export const TEMPLATE_VARIABLES = [
  "parent",
  "famille",
  "montant",
  "enfants",
  "ecole",
  "remarque",
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** A household is not messaged again inside this many days. */
export const COOL_DOWN_DAYS = 7;

/** The longest message a manager may write. */
export const MAX_TEMPLATE_LENGTH = 1000;
