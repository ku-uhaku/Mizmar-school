import "server-only";

import { db } from "@/lib/db";
import { sendText } from "@/modules/messaging/openwa";
import { refund } from "@/modules/messaging/service";

/**
 * The background sender, started once from instrumentation.ts.
 *
 * ── Why a loop in the app and not a queue service ───────────────────────────
 * The deployment has no cron and no broker, and a school sends a few hundred
 * messages at a time. The state that matters — what is pending, what was
 * claimed — lives in MySQL, so the loop can die and restart at any point and
 * lose nothing: a row claimed by a process that died is put back after
 * `STALE_MS`, and the claim itself is an atomic UPDATE, so two app instances
 * cannot send the same message.
 *
 * ── Why it is slow on purpose ───────────────────────────────────────────────
 * OpenWA drives a real WhatsApp account, and a burst of identical messages is
 * what gets one banned. One message per few seconds, with jitter, is the whole
 * safety measure.
 */

const STALE_MS = 5 * 60 * 1000;
const IDLE_MS = 10_000;
const PAUSED_BACKOFF_MS = 60_000;

function pause(): number {
  const base = Number(process.env.MESSAGING_DELAY_MS) || 6_000;
  return base + Math.floor(Math.random() * base * 0.5);
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Handles at most one delivery. Returns how long to wait before the next. */
export async function processOne(): Promise<number> {
  await db.messageDelivery.updateMany({
    where: {
      status: "SENDING",
      claimedAt: { lt: new Date(Date.now() - STALE_MS) },
    },
    data: { status: "PENDING", claimedAt: null },
  });

  const next = await db.messageDelivery.findFirst({
    where: {
      status: "PENDING",
      campaign: { status: { in: ["QUEUED", "RUNNING"] } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { campaign: { select: { id: true, organizationId: true } } },
  });
  if (!next) return IDLE_MS;

  const claimed = await db.messageDelivery.updateMany({
    where: { id: next.id, status: "PENDING" },
    data: { status: "SENDING", claimedAt: new Date() },
  });
  if (claimed.count === 0) return 0; // another instance took it

  await db.messageCampaign.updateMany({
    where: { id: next.campaign.id, status: "QUEUED" },
    data: { status: "RUNNING" },
  });

  const result = await sendText(next.phone, next.body);

  if (result.ok) {
    await db.messageDelivery.update({
      where: { id: next.id },
      data: { status: "SENT", sentAt: new Date(), claimedAt: null, error: null },
    });
    await settleCampaign(next.campaign.id);
    return pause();
  }

  if (result.kind === "session") {
    // Nothing is wrong with the message. Give it back and stop the campaign
    // until somebody has looked at the phone — no credit moves.
    await db.messageDelivery.update({
      where: { id: next.id },
      data: {
        status: "PENDING",
        claimedAt: null,
        error: result.error.slice(0, 500),
      },
    });
    await db.messageCampaign.update({
      where: { id: next.campaign.id },
      data: { status: "PAUSED" },
    });
    return PAUSED_BACKOFF_MS;
  }

  await db.$transaction(async (tx) => {
    const failed = await tx.messageDelivery.updateMany({
      where: { id: next.id, status: "SENDING" },
      data: {
        status: "FAILED",
        claimedAt: null,
        error: result.error.slice(0, 500),
      },
    });
    if (failed.count === 1) {
      await refund(tx, next.campaign.organizationId, 1, next.campaign.id, null);
    }
  });
  await settleCampaign(next.campaign.id);
  return pause();
}

async function settleCampaign(campaignId: string): Promise<void> {
  const open = await db.messageDelivery.count({
    where: { campaignId, status: { in: ["PENDING", "SENDING"] } },
  });
  if (open === 0) {
    await db.messageCampaign.updateMany({
      where: { id: campaignId, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "DONE" },
    });
  }
}

const globalForWorker = globalThis as unknown as {
  __messagingWorker?: boolean;
};

/** Starts the loop once per process — dev reloads would otherwise stack them. */
export function startMessagingWorker(): void {
  if (globalForWorker.__messagingWorker) return;
  globalForWorker.__messagingWorker = true;

  void (async () => {
    for (;;) {
      let wait = IDLE_MS;
      try {
        wait = await processOne();
      } catch (error) {
        console.error("Messaging worker:", error);
        wait = PAUSED_BACKOFF_MS;
      }
      await sleep(wait);
    }
  })();
}
