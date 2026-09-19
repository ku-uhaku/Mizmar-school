import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { COOL_DOWN_DAYS } from "@/modules/messaging/enums";

/**
 * Writes for the messaging module — credits and the campaign lifecycle.
 *
 * ── Credits are a ledger, not a counter ─────────────────────────────────────
 * `MessageCredit.balance` only ever moves in the same transaction that writes
 * its `CreditLedger` line, and it moves by conditional UPDATE, so the balance
 * cannot go below zero however many campaigns are queued at once.
 */

export class InsufficientCreditsError extends Error {
  constructor(
    readonly available: number,
    readonly needed: number,
  ) {
    super(`Insufficient credits: ${available} available, ${needed} needed`);
    this.name = "InsufficientCreditsError";
  }
}

export class CampaignInProgressError extends Error {
  constructor() {
    super("A campaign is already in progress for this school");
    this.name = "CampaignInProgressError";
  }
}

/**
 * The platform owner — the person who sells the credits, not a school's admin.
 *
 * A permission code cannot express this: `Administrateur` gets the whole
 * catalogue, so any code would land in the very hands that must not hold it. It
 * is the super-admin flag, narrowed by `MESSAGING_OWNER_USERNAMES` (comma list)
 * when a school's own super admin must not be able to give itself credits.
 */
export function isCreditOwner(user: {
  isSuperAdmin: boolean;
  username: string;
}): boolean {
  if (!user.isSuperAdmin) return false;
  const allowed = (process.env.MESSAGING_OWNER_USERNAMES ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(user.username.toLowerCase());
}

export async function topUpCredits(
  organizationId: string,
  amount: number,
  note: string | null,
  userId: string,
): Promise<number> {
  return db.$transaction(async (tx) => {
    await tx.messageCredit.upsert({
      where: { organizationId },
      create: { organizationId, balance: amount },
      update: { balance: { increment: amount } },
    });
    await tx.creditLedger.create({
      data: {
        organizationId,
        delta: amount,
        reason: "TOPUP",
        note,
        createdById: userId,
      },
    });
    const row = await tx.messageCredit.findUniqueOrThrow({
      where: { organizationId },
    });
    return row.balance;
  });
}

export type QueueInput = {
  template: string;
  remark: string | null;
  filters: string;
  recipients: { familyId: string; phone: string; body: string }[];
};

/**
 * Reserves the credits and writes the campaign with all its deliveries, in one
 * transaction: either the school is charged and the messages are queued, or
 * neither happened.
 */
export async function queueCampaign(
  context: AuthContext,
  input: QueueInput,
): Promise<{ campaignId: string; count: number }> {
  const organizationId = context.organization.id;
  const schoolId = context.currentSchool?.id;
  if (!schoolId) throw new Error("No school in context");
  const count = input.recipients.length;

  return db.$transaction(async (tx) => {
    const active = await tx.messageCampaign.count({
      where: { schoolId, status: { in: ["QUEUED", "RUNNING", "PAUSED"] } },
    });
    if (active > 0) throw new CampaignInProgressError();

    const reserved = await tx.messageCredit.updateMany({
      where: { organizationId, balance: { gte: count } },
      data: { balance: { decrement: count } },
    });
    if (reserved.count === 0) {
      const row = await tx.messageCredit.findUnique({
        where: { organizationId },
      });
      throw new InsufficientCreditsError(row?.balance ?? 0, count);
    }

    const campaign = await tx.messageCampaign.create({
      data: {
        organizationId,
        schoolId,
        kind: "PAYMENT_REMINDER",
        template: input.template,
        remark: input.remark,
        filters: input.filters,
        reservedCredits: count,
        createdById: context.user.id,
        deliveries: {
          create: input.recipients.map((r) => ({
            familyId: r.familyId,
            phone: r.phone,
            body: r.body,
          })),
        },
      },
    });
    await tx.creditLedger.create({
      data: {
        organizationId,
        delta: -count,
        reason: "RESERVE",
        campaignId: campaign.id,
        createdById: context.user.id,
      },
    });
    return { campaignId: campaign.id, count };
  });
}

/** Stops a campaign and gives back the credits of everything not yet sent. */
export async function cancelCampaign(
  context: AuthContext,
  campaignId: string,
): Promise<number> {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return 0;

  return db.$transaction(async (tx) => {
    // Scoped by school from the session, never from the request.
    const campaign = await tx.messageCampaign.findFirst({
      where: {
        id: campaignId,
        schoolId,
        status: { in: ["QUEUED", "RUNNING", "PAUSED"] },
      },
    });
    if (!campaign) return 0;

    // Only rows still PENDING: a SENDING one is mid-flight and settles itself.
    const cancelled = await tx.messageDelivery.updateMany({
      where: { campaignId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count > 0) {
      await refund(
        tx,
        campaign.organizationId,
        cancelled.count,
        campaignId,
        context.user.id,
      );
    }
    await tx.messageCampaign.update({
      where: { id: campaignId },
      data: { status: "CANCELLED" },
    });
    return cancelled.count;
  });
}

/** Un-pauses a campaign the worker stopped because the phone was unpaired. */
export async function resumeCampaign(
  context: AuthContext,
  campaignId: string,
): Promise<void> {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return;
  await db.messageCampaign.updateMany({
    where: { id: campaignId, schoolId, status: "PAUSED" },
    data: { status: "QUEUED" },
  });
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export async function refund(
  tx: Tx,
  organizationId: string,
  count: number,
  campaignId: string,
  userId: string | null,
): Promise<void> {
  await tx.messageCredit.update({
    where: { organizationId },
    data: { balance: { increment: count } },
  });
  await tx.creditLedger.create({
    data: {
      organizationId,
      delta: count,
      reason: "REFUND",
      campaignId,
      createdById: userId,
    },
  });
}

export function coolDownCutoff(now = new Date()): Date {
  return new Date(now.getTime() - COOL_DOWN_DAYS * 24 * 60 * 60 * 1000);
}
