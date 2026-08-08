import "server-only";

import { parseChanges, parseMetadata, type ChangeSet } from "@/lib/audit";
import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { currentSchoolId } from "@/lib/scope";
import { domainOf, hrefFor, modelsInDomain } from "@/modules/audit/entities";
import {
  ACTIVITY_DOMAINS,
  isSecurityAction,
  SECURITY_ACTIONS,
  type ActivityAction,
  type ActivityDomain,
} from "@/modules/audit/enums";

/**
 * Reads for the audit trail.
 *
 * ── What a reader is allowed to see ──────────────────────────────────────────
 * Two narrowings, applied here rather than by any caller, so the list, the
 * counts and the per-record panel cannot disagree about them:
 *
 *   1. Scope. `audit.view` held org-wide reads the whole organisation.
 *      Held only in a school, it reads that school's entries and the entries
 *      with no school at all are withheld — an org-level act (creating a
 *      school, editing a role) is not one school's business.
 *   2. Security events. Sign-ins, refused passwords and refused permissions are
 *      only returned to a reader holding `audit.security`. Without it the trail
 *      still reads completely as a record of *changes*; it simply says nothing
 *      about people.
 *
 * A reader holding neither code gets nothing back rather than an error: the
 * page has already refused them, and a query that silently returns everything
 * when called from somewhere else is how a leak happens.
 */

const PAGE_SIZE = 50;

export type ActivityFilters = {
  actorId?: string;
  action?: string;
  domain?: string;
  entity?: string;
  /** One record's own trail — what the "see everything" link on a panel sets. */
  entityId?: string;
  /** ISO dates, inclusive. */
  from?: string;
  to?: string;
  /** Matches the affected row's label or the actor's name. */
  search?: string;
  page?: number;
};

export type ActivityEntry = {
  id: string;
  createdAt: Date;
  actorId: string | null;
  actorLabel: string;
  actorEmail: string | null;
  action: ActivityAction;
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  domain: ActivityDomain;
  /** Where to read the affected row, when it has a screen of its own. */
  href: string | null;
  changes: ChangeSet | null;
  metadata: Record<string, unknown> | null;
  schoolId: string | null;
};

export type ActivityPage = {
  entries: ActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type Where = NonNullable<Parameters<typeof db.activityLog.findMany>[0]>["where"];

/**
 * The clause every read starts from — the reader's own reach, never a scope
 * taken from the request.
 *
 * Returns null when the reader may see nothing at all, which callers turn into
 * an empty page rather than a query.
 */
function readableScope(context: AuthContext): Where | null {
  const orgWide = context.canOrg(PERMISSIONS.AUDIT_VIEW);
  const inSchool = context.can(PERMISSIONS.AUDIT_VIEW);
  if (!orgWide && !inSchool) return null;

  const canSeeSecurity =
    context.canOrg(PERMISSIONS.AUDIT_SECURITY) ||
    context.can(PERMISSIONS.AUDIT_SECURITY);

  const scope: Where = orgWide
    ? { organizationId: context.organization.id }
    : // Confined to the school in context, and never to entries that belong to
      // no school — those are org-level acts.
      {
        organizationId: context.organization.id,
        schoolId: currentSchoolId(context),
      };

  if (canSeeSecurity) return scope;

  return {
    ...scope,
    action: { notIn: [...SECURITY_ACTIONS] },
  };
}

/** A day string from the filter, or null when it is not a date. */
function parseDay(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toEntry(row: {
  id: string;
  createdAt: Date;
  actorId: string | null;
  actorLabel: string;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  changes: string | null;
  metadata: string | null;
  schoolId: string | null;
}): ActivityEntry {
  return {
    id: row.id,
    createdAt: row.createdAt,
    actorId: row.actorId,
    actorLabel: row.actorLabel,
    actorEmail: row.actorEmail,
    action: row.action as ActivityAction,
    entity: row.entity,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    domain: domainOf(row.entity),
    // A deleted row has no page left to link to, so the entry stops being a
    // link the moment it becomes the only record of what was there.
    href: row.action === "DELETE" ? null : hrefFor(row.entity, row.entityId),
    changes: parseChanges(row.changes),
    metadata: parseMetadata(row.metadata),
    schoolId: row.schoolId,
  };
}

const EMPTY_PAGE: ActivityPage = {
  entries: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  pageCount: 0,
};

/**
 * One page of the trail, newest first.
 *
 * Paged in the database rather than in the browser like the rest of the app's
 * tables: this is the one dataset with no ceiling — it grows by a line for
 * every write anybody makes — so shipping it whole is the one thing that must
 * not happen.
 */
export async function listActivity(
  context: AuthContext,
  filters: ActivityFilters = {},
): Promise<ActivityPage> {
  const scope = readableScope(context);
  if (!scope) return EMPTY_PAGE;

  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const from = parseDay(filters.from, false);
  const to = parseDay(filters.to, true);

  // A domain narrows to the models filed under it; an explicit entity wins,
  // since it is the finer of the two.
  const entityClause = filters.entity
    ? { entity: filters.entity }
    : filters.domain && isDomain(filters.domain)
      ? { entity: { in: modelsInDomain(filters.domain) } }
      : {};

  const chosen: Where = {
    ...entityClause,
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { entityLabel: { contains: filters.search } },
            { actorLabel: { contains: filters.search } },
            { actorEmail: { contains: filters.search } },
          ],
        }
      : {}),
  };

  /*
    ── The reader's reach AND their filter, never one spread over the other ────
    Both halves name `action`: the scope carries `{ notIn: SECURITY_ACTIONS }`
    for a reader without `audit.security`, and the filter carries whatever came
    in the query string. Spread into one object the later key simply won, so
    `?action=LOGIN_FAILED` handed a holder of `audit.view` alone the whole
    security half of the trail — every refused password and the address it was
    tried against. The picker narrows itself to what the reader may see, but the
    picker is a client component and the URL is not.

    ANDed, the filter can only ever narrow inside the reach, and no future
    filter can collide with a scope column by sharing its name.
  */
  const where: Where = { AND: [scope, chosen] };

  const [total, rows] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    entries: rows.map(toEntry),
    total,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

function isDomain(value: string): value is ActivityDomain {
  return (ACTIVITY_DOMAINS as readonly string[]).includes(value);
}

/**
 * One row's own timeline, for the history panel on a detail screen.
 *
 * Scoped by the same rule as the list — a reader who may not read the trail
 * gets an empty history rather than a forbidden panel, because the panel is
 * only rendered for readers who may.
 */
export async function loadRecordHistory(
  context: AuthContext,
  entity: string,
  entityId: string,
  limit = 20,
): Promise<ActivityEntry[]> {
  const scope = readableScope(context);
  if (!scope) return [];

  const rows = await db.activityLog.findMany({
    where: { ...scope, entity, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map(toEntry);
}

/**
 * The people who appear in the trail, for the actor filter.
 *
 * Read off the trail itself rather than off the user table, so somebody who has
 * since left still appears in the list of who did things — and so the filter
 * never offers a name with nothing behind it.
 */
export async function listActivityActors(
  context: AuthContext,
): Promise<{ id: string; label: string }[]> {
  const scope = readableScope(context);
  if (!scope) return [];

  const rows = await db.activityLog.findMany({
    where: { ...scope, actorId: { not: null } },
    distinct: ["actorId"],
    select: { actorId: true, actorLabel: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows
    .flatMap((row) =>
      row.actorId ? [{ id: row.actorId, label: row.actorLabel }] : [],
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Whether this reader may be shown the trail at all — org-wide or in the school
 * they are working in. What that lets them actually read is decided by
 * `readableScope`; this only says whether to render the panel.
 */
export function canReadTrail(context: AuthContext): boolean {
  return (
    context.canOrg(PERMISSIONS.AUDIT_VIEW) || context.can(PERMISSIONS.AUDIT_VIEW)
  );
}

/** Whether this reader may be shown the security half of the trail at all. */
export function canReadSecurity(context: AuthContext): boolean {
  return (
    context.canOrg(PERMISSIONS.AUDIT_SECURITY) ||
    context.can(PERMISSIONS.AUDIT_SECURITY)
  );
}

/** The actions offered in the filter, narrowed to what this reader may see. */
export function readableActions(context: AuthContext): ActivityAction[] {
  const all: ActivityAction[] = [
    "CREATE",
    "UPDATE",
    "DELETE",
    "CREATE_MANY",
    "UPDATE_MANY",
    "DELETE_MANY",
    ...SECURITY_ACTIONS,
  ];
  return canReadSecurity(context)
    ? all
    : all.filter((action) => !isSecurityAction(action));
}
