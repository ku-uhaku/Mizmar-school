"use server";

import { refresh } from "next/cache";

import {
  failure,
  success,
  successWith,
  type ActionState,
  type ActionStateWith,
} from "@/lib/action-state";
import { authorizeSchool, requireAuth, type AuthContext } from "@/lib/dal";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { MAX_TEMPLATE_LENGTH } from "@/modules/messaging/enums";
import { parseFilters } from "@/modules/messaging/filters";
import { isGatewayConfigured } from "@/modules/messaging/openwa";
import { renderFor, selectRecipients } from "@/modules/messaging/queries";
import {
  cancelCampaign,
  CampaignInProgressError,
  InsufficientCreditsError,
  isCreditOwner,
  queueCampaign,
  resumeCampaign,
  topUpCredits,
} from "@/modules/messaging/service";

/**
 * Actions for the messaging module.
 *
 * The school is the one in the session, never one from the request, and the
 * recipients are re-derived here from the filters — the browser sends *how the
 * list was narrowed*, not *who to write to*. A crafted request can therefore
 * only ever reach a household the reminders screen would have offered.
 */

async function authorizeSend(): Promise<AuthContext> {
  const context = await requireAuth();
  return authorizeSchool(
    context.currentSchool?.id ?? "",
    PERMISSIONS.MESSAGING_SEND,
  );
}

export type SendRemindersInput = {
  template: string;
  remark: string;
  filters: unknown;
  excludedFamilyIds: string[];
};

export async function sendRemindersAction(
  input: SendRemindersInput,
): Promise<ActionStateWith<{ campaignId: string }> | ActionState> {
  return withActionErrors(async () => {
    const context = await authorizeSend();
    const t = await getDictionary();
    const locale = await getLocale();

    const template = String(input.template ?? "").trim();
    const remark = String(input.remark ?? "").trim().slice(0, 500);
    if (template === "" || template.length > MAX_TEMPLATE_LENGTH) {
      return failure(t.messaging.errors.templateInvalid);
    }
    if (!isGatewayConfigured()) return failure(t.messaging.errors.notConfigured);

    const filters = parseFilters(input.filters);
    const excluded = Array.isArray(input.excludedFamilyIds)
      ? input.excludedFamilyIds.map(String)
      : [];

    const rows = await selectRecipients(context, filters, excluded);
    if (rows.length === 0) return failure(t.messaging.errors.noRecipients);

    const schoolName = context.currentSchool?.name ?? "";
    const currency = context.settings.currencyCode;

    try {
      const { campaignId, count } = await queueCampaign(context, {
        template,
        remark: remark || null,
        filters: JSON.stringify(filters),
        recipients: rows.map((row) => ({
          familyId: row.familyId,
          phone: row.phone as string,
          body: renderFor(template, row, remark, schoolName, locale, currency),
        })),
      });
      refresh();
      return successWith(
        { campaignId },
        interpolate(t.messaging.queued, { count }),
      );
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return failure(
          interpolate(t.messaging.errors.insufficientCredits, {
            available: error.available,
            needed: error.needed,
          }),
        );
      }
      if (error instanceof CampaignInProgressError) {
        return failure(t.messaging.errors.campaignInProgress);
      }
      throw error;
    }
  });
}

export async function cancelCampaignAction(
  campaignId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const context = await authorizeSend();
    const t = await getDictionary();
    const refunded = await cancelCampaign(context, String(campaignId));
    refresh();
    return success(interpolate(t.messaging.cancelled, { count: refunded }));
  });
}

export async function resumeCampaignAction(
  campaignId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const context = await authorizeSend();
    await resumeCampaign(context, String(campaignId));
    refresh();
    return success();
  });
}

/** The platform owner adds credits. Not reachable by any school role. */
export async function topUpCreditsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const context = await requireAuth();
    const t = await getDictionary();
    // Refused as a plain "forbidden", the same as a missing permission: whether
    // an owner exists is not the caller's business.
    if (!isCreditOwner(context.user)) return failure(t.errors.forbidden);

    const amount = Number(field(formData, "amount"));
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
      return failure(t.messaging.errors.amountInvalid, {
        amount: t.messaging.errors.amountInvalid,
      });
    }
    const note = field(formData, "note").slice(0, 500) || null;

    const balance = await topUpCredits(
      context.organization.id,
      amount,
      note,
      context.user.id,
    );
    refresh();
    return success(interpolate(t.messaging.toppedUp, { balance }));
  });
}
