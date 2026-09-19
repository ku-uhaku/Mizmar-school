import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { schoolScope } from "@/lib/scope";
import {
  matchesFilters,
  type ReminderFilters,
  type SkipReason,
} from "@/modules/messaging/filters";
import { gatewayStatus, type GatewayStatus } from "@/modules/messaging/openwa";
import { normalisePhone } from "@/modules/messaging/phone";
import { coolDownCutoff, isCreditOwner } from "@/modules/messaging/service";
import { renderTemplate, type TemplateValues } from "@/modules/messaging/template";
import {
  listReminderTargets,
  type ReminderTarget,
} from "@/modules/treasury/queries";

/**
 * Reads for the messaging module. Every read is confined to the current school
 * (or the organisation, for credits) taken from the session.
 */

export type ReminderRow = ReminderTarget & {
  /** Normalised, or null when the number cannot receive WhatsApp. */
  phone: string | null;
  skip: SkipReason | null;
};

export type ReminderScreen = {
  rows: ReminderRow[];
  levels: { id: string; label: string }[];
  classes: { id: string; label: string }[];
  balance: number;
  gateway: GatewayStatus;
  isOwner: boolean;
  currencyCode: string;
  schoolName: string;
  activeCampaignId: string | null;
};

/** Households already messaged, or queued, inside the cool-down window. */
async function recentlyMessaged(
  context: AuthContext,
  familyIds: string[],
): Promise<Set<string>> {
  if (familyIds.length === 0) return new Set();
  const recent = await db.messageDelivery.findMany({
    where: {
      familyId: { in: familyIds },
      status: { in: ["PENDING", "SENDING", "SENT"] },
      createdAt: { gte: coolDownCutoff() },
      campaign: { organizationId: context.organization.id },
    },
    select: { familyId: true },
  });
  return new Set(recent.map((row) => row.familyId));
}

/**
 * The late households, each marked with whether it will actually be messaged.
 *
 * The one place a recipient is decided: the screen calls it to draw the list
 * and the send action calls it again to pick who goes, so a crafted request
 * cannot add a household this function did not offer.
 */
export async function resolveReminderRows(
  context: AuthContext,
): Promise<{
  rows: ReminderRow[];
  levels: { id: string; label: string }[];
  classes: { id: string; label: string }[];
}> {
  const { targets, levels, classes } = await listReminderTargets(context);
  const recent = await recentlyMessaged(
    context,
    targets.map((target) => target.familyId),
  );

  const rows = targets.map((target): ReminderRow => {
    const phone = normalisePhone(target.contactPhone);
    return {
      ...target,
      phone,
      skip: !phone ? "NO_PHONE" : recent.has(target.familyId) ? "COOL_DOWN" : null,
    };
  });
  return { rows, levels, classes };
}

/** The households a send with these filters would reach. */
export async function selectRecipients(
  context: AuthContext,
  filters: ReminderFilters,
  excludedFamilyIds: readonly string[],
): Promise<ReminderRow[]> {
  const { rows } = await resolveReminderRows(context);
  return rows.filter(
    (row) =>
      row.skip === null &&
      !excludedFamilyIds.includes(row.familyId) &&
      matchesFilters(row, filters),
  );
}

export function messageValuesFor(
  row: ReminderRow,
  remark: string,
  schoolName: string,
  locale: Locale,
  currencyCode: string,
): TemplateValues {
  return {
    parent: row.contactName,
    famille: row.familyName,
    montant: formatMoney(row.overdueCentimes, locale, currencyCode),
    enfants: row.childNames.join(", "),
    ecole: schoolName,
    remarque: remark,
  };
}

export function renderFor(
  template: string,
  row: ReminderRow,
  remark: string,
  schoolName: string,
  locale: Locale,
  currencyCode: string,
): string {
  return renderTemplate(
    template,
    messageValuesFor(row, remark, schoolName, locale, currencyCode),
  );
}

export async function creditBalance(organizationId: string): Promise<number> {
  const row = await db.messageCredit.findUnique({ where: { organizationId } });
  return row?.balance ?? 0;
}

export async function loadReminderScreen(
  context: AuthContext,
): Promise<ReminderScreen> {
  const [{ rows, levels, classes }, balance, gateway, active] =
    await Promise.all([
      resolveReminderRows(context),
      creditBalance(context.organization.id),
      gatewayStatus(),
      db.messageCampaign.findFirst({
        where: {
          ...schoolScope(context),
          status: { in: ["QUEUED", "RUNNING", "PAUSED"] },
        },
        select: { id: true },
      }),
    ]);

  return {
    rows,
    levels,
    classes,
    balance,
    gateway,
    isOwner: isCreditOwner(context.user),
    currencyCode: context.settings.currencyCode,
    schoolName: context.currentSchool?.name ?? "",
    activeCampaignId: active?.id ?? null,
  };
}

export type CampaignSummary = {
  id: string;
  status: string;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  cancelled: number;
};

const campaignSummary = (campaign: {
  id: string;
  status: string;
  createdAt: Date;
  deliveries: { status: string }[];
}): CampaignSummary => {
  const count = (status: string) =>
    campaign.deliveries.filter((d) => d.status === status).length;
  return {
    id: campaign.id,
    status: campaign.status,
    createdAt: campaign.createdAt.toISOString(),
    total: campaign.deliveries.length,
    sent: count("SENT"),
    failed: count("FAILED"),
    pending: count("PENDING") + count("SENDING"),
    cancelled: count("CANCELLED"),
  };
};

export async function listCampaigns(
  context: AuthContext,
): Promise<CampaignSummary[]> {
  const campaigns = await db.messageCampaign.findMany({
    where: schoolScope(context),
    orderBy: [{ createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
      deliveries: { select: { status: true } },
    },
  });
  return campaigns.map(campaignSummary);
}

export type CampaignDetail = CampaignSummary & {
  template: string;
  deliveries: {
    id: string;
    familyName: string;
    phone: string;
    status: string;
    error: string | null;
    sentAt: string | null;
  }[];
};

export async function findCampaign(
  context: AuthContext,
  campaignId: string,
): Promise<CampaignDetail | null> {
  const campaign = await db.messageCampaign.findFirst({
    where: { id: campaignId, ...schoolScope(context) },
    select: {
      id: true,
      status: true,
      createdAt: true,
      template: true,
      deliveries: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          familyId: true,
          phone: true,
          status: true,
          error: true,
          sentAt: true,
        },
      },
    },
  });
  if (!campaign) return null;

  const families = await db.family.findMany({
    where: {
      schoolId: context.currentSchool?.id,
      id: { in: campaign.deliveries.map((d) => d.familyId) },
    },
    select: { id: true, name: true },
  });
  const names = new Map(families.map((family) => [family.id, family.name]));

  return {
    ...campaignSummary(campaign),
    template: campaign.template,
    deliveries: campaign.deliveries.map((d) => ({
      id: d.id,
      familyName: names.get(d.familyId) ?? "—",
      phone: d.phone,
      status: d.status,
      error: d.error,
      sentAt: d.sentAt?.toISOString() ?? null,
    })),
  };
}

export type CreditsOverview = {
  balance: number;
  ledger: {
    id: string;
    delta: number;
    reason: string;
    note: string | null;
    createdAt: string;
  }[];
};

export async function loadCreditsOverview(
  context: AuthContext,
): Promise<CreditsOverview> {
  const organizationId = context.organization.id;
  const [balance, ledger] = await Promise.all([
    creditBalance(organizationId),
    db.creditLedger.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);
  return {
    balance,
    ledger: ledger.map((line) => ({
      id: line.id,
      delta: line.delta,
      reason: line.reason,
      note: line.note,
      createdAt: line.createdAt.toISOString(),
    })),
  };
}
