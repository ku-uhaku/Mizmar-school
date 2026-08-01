/**
 * Allowed values for this module's "enum-like" String columns — the source of
 * truth for `prisma/schema/billing/*.prisma`. Labels belong in
 * `modules/billing/i18n/*.ts` once this module grows a UI.
 *
 * Every amount in this module is an integer number of **centimes of dirham**,
 * and every percentage an integer number of **basis points**. Nothing here is a
 * float: these numbers are summed, discounted and split into instalments, and a
 * rounding drift is money a parent will dispute.
 */

import { nullableKey } from "@/lib/db-keys";

/**
 * What a charge is for. Drives grouping on an invoice and on the accountant's
 * report far more than it drives behaviour.
 *
 *   TUITION       scolarité — the main annual charge
 *   REGISTRATION  frais d'inscription / réinscription
 *   INSURANCE     assurance scolaire, usually a small flat sum
 *   TRANSPORT     bus — one flat fee, whatever level and however far they live
 *   CANTEEN       cantine / restauration
 *   CLUB          club or activité parascolaire, opt-in
 *   SUPPLIES      fournitures, manuels
 *   UNIFORM       tenue scolaire
 *   EXAM          frais d'examen
 *   OTHER         anything the school invents
 */
export const FEE_KINDS = [
  "TUITION",
  "REGISTRATION",
  "INSURANCE",
  "TRANSPORT",
  "CANTEEN",
  "CLUB",
  "SUPPLIES",
  "UNIFORM",
  "EXAM",
  "OTHER",
] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

/**
 * How a charge is collected.
 *
 * Moroccan private schools quote scolarité as one annual figure and collect it
 * in monthly instalments, so the quoted amount and the collection rhythm are
 * separate facts — `FeeRate.instalmentCount` overrides this per price.
 */
export const BILLING_CYCLES = ["ANNUAL", "MONTHLY", "TERM", "ONE_OFF"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/** How a reduction is expressed. */
export const DISCOUNT_KINDS = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

/**
 * Why a reduction exists. Reporting on what the school gives away, broken down
 * by reason, is a figure its accountant will ask for.
 *
 *   SIBLING        réduction fratrie — the commonest by far
 *   STAFF          enfant du personnel
 *   EARLY_PAYMENT  paiement anticipé de l'année
 *   SCHOLARSHIP    bourse
 *   MERIT          excellence académique
 *   HARDSHIP       cas social
 */
export const DISCOUNT_REASONS = [
  "SIBLING",
  "STAFF",
  "EARLY_PAYMENT",
  "SCHOLARSHIP",
  "MERIT",
  "HARDSHIP",
  "OTHER",
] as const;
export type DiscountReason = (typeof DISCOUNT_REASONS)[number];

/** 100 basis points = 1 %. A whole discount is 10 000 bps. */
export const BPS_PER_PERCENT = 100;
export const BPS_FULL = 10_000;

/**
 * Applies a basis-point reduction to an amount in centimes.
 *
 * Rounds once, at the end, to the nearest centime — the only place this maths
 * should happen, so an invoice line and its total can never round differently.
 */
export function applyPercentBps(
  amountCentimes: number,
  percentBps: number,
): number {
  return Math.round((amountCentimes * (BPS_FULL - percentBps)) / BPS_FULL);
}

/**
 * Splits an amount into `count` instalments without losing a centime.
 *
 * Returns the instalments in order; the remainder is spread over the first ones,
 * so the parts always sum exactly back to `amountCentimes`. Dividing and
 * rounding each part independently is what leaves a school one centime short on
 * every plan it issues.
 */
export function splitIntoInstalments(
  amountCentimes: number,
  count: number,
): number[] {
  if (count <= 0) return [];
  const base = Math.floor(amountCentimes / count);
  const remainder = amountCentimes - base * count;
  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
}

/**
 * Builds `FeeRate.scopeKey`, which is what stops one fee having two "all levels"
 * prices in the same year — see lib/db-keys.ts for why the nullable `levelId`
 * cannot be indexed directly.
 */
export function feeRateScopeKey(levelId: string | null | undefined): string {
  return nullableKey(levelId);
}
