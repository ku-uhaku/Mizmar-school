import "server-only";

import type { PrismaClient } from "@/lib/generated/prisma/client";
import {
  IGNORED_FIELDS,
  isRedacted,
  labelOf,
  scopeOf,
  UNAUDITED_MODELS,
} from "@/modules/audit/entities";
import type { ActivityAction } from "@/modules/audit/enums";

/**
 * The audit trail's capture layer.
 *
 * ── Why it lives inside the Prisma client ────────────────────────────────────
 * The alternative was a `recordActivity()` call in every service, and the
 * alternative is how audit trails rot: the call is added to the writes somebody
 * thought of in the week the feature shipped, and every write added afterwards
 * is silently unlogged. Nobody notices, because the screen still shows entries.
 *
 * A client extension has no such failure mode. It sits under every module and
 * sees every `create`, `update` and `delete` the app makes, on tables that do
 * not exist yet as much as on tables that do. `modules/audit/entities.ts` says
 * where a table's history is filed and what its rows are called; that file is
 * exhaustive over the schema, so a new table is a compile error rather than a
 * gap in the trail.
 *
 * ── Why it lives in `lib/` ──────────────────────────────────────────────────
 * Because `lib/db.ts` has to apply it, and `lib/` may not import a module's
 * server code. It imports only the audit module's pure data, exactly as
 * `lib/permissions.ts` imports the modules' permission codes.
 *
 * ── What it costs ───────────────────────────────────────────────────────────
 * One extra read before an update or a delete (to diff against) and one insert
 * after. Against writes that are already user-initiated form submissions, on a
 * MySQL server sized for one school, that is not a cost worth engineering
 * around.
 * Reads are untouched.
 *
 * ── What it does not catch ──────────────────────────────────────────────────
 * 1. Nested writes. `family.update({ data: { guardians: { create: … } } })` is
 *    one operation to Prisma, so it logs as one entry against the Family. The
 *    guardian's own creation is inside `changes`, not a line of its own.
 * 2. Raw SQL. `$queryRaw` bypasses the client's operation layer entirely.
 * 3. Rolled-back transactions. The entry is written the moment the operation
 *    succeeds, before any enclosing `$transaction` has committed. Prisma runs
 *    the extension's write on the transaction's own connection, so it rolls
 *    back with the data — an abandoned transaction leaves no trace of itself.
 *    Were it to go down a second connection from the pool it would survive
 *    instead, and the trail would carry an act that was attempted and undone.
 *    Either is defensible;
 *    neither is worth a second write path to control.
 * 4. The seed, and any script using `prisma/seed/client.ts` — a separate client
 *    with no extension. Deliberate: the seed is not somebody doing something.
 */

/** The unextended client, used to read "before" and to write the entry itself. */
type BaseClient = PrismaClient;

/** Operations that change data. Everything else falls straight through. */
const WRITE_OPERATIONS: Record<string, ActivityAction> = {
  create: "CREATE",
  createMany: "CREATE_MANY",
  createManyAndReturn: "CREATE_MANY",
  update: "UPDATE",
  updateMany: "UPDATE_MANY",
  updateManyAndReturn: "UPDATE_MANY",
  upsert: "UPDATE",
  delete: "DELETE",
  deleteMany: "DELETE_MANY",
};

/** How many affected ids a bulk operation records before it just gives a count. */
const BULK_ID_CAP = 50;

/** Longest value kept in a diff. Photo data-URIs are the reason this exists. */
const MAX_VALUE_LENGTH = 300;

type Row = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
//  Turning column values into something a JSON column can hold
// ─────────────────────────────────────────────────────────────────────────────

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `<binary:${value.byteLength}>`;
  if (typeof value === "string") {
    return value.length > MAX_VALUE_LENGTH
      ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
      : value;
  }
  if (typeof value === "object") {
    // Prisma's Decimal, and anything else that knows how to say what it is.
    const asString = String(value);
    return asString.length > MAX_VALUE_LENGTH
      ? `${asString.slice(0, MAX_VALUE_LENGTH)}…`
      : asString;
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === b) return true;
  // Decimals and the like compare by their text, which is how they are stored.
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    return String(a) === String(b);
  }
  return false;
}

export type FieldChange = { from: unknown; to: unknown };
export type ChangeSet = Record<string, FieldChange>;

/**
 * What actually changed between two versions of a row.
 *
 * Computed from the rows themselves rather than from the `data` argument: a
 * form that submits every field posts thirty of them and changes one, and a
 * trail that says "thirty fields were written" is a trail nobody reads twice.
 * It also means `{ increment: 1 }` and every other atomic operation records the
 * number it landed on rather than the instruction.
 */
function diff(before: Row | null, after: Row | null): ChangeSet | null {
  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const changes: ChangeSet = {};

  for (const field of fields) {
    if (IGNORED_FIELDS.includes(field)) continue;

    const from = before ? before[field] : undefined;
    const to = after ? after[field] : undefined;
    if (before && after && sameValue(from, to)) continue;

    // A creation lists what the row was given, not the twenty optional columns
    // it was not; a deletion lists what is being lost. Either way, a column
    // that was null on both sides of the event is not news.
    if (!before && (to === null || to === undefined)) continue;
    if (!after && (from === null || from === undefined)) continue;

    if (isRedacted(field)) {
      // Recorded as having changed — that a password was reset is exactly the
      // kind of thing a trail is for — but never with either value.
      changes[field] = { from: from === undefined ? null : "•••", to: "•••" };
      continue;
    }

    changes[field] = {
      from: from === undefined ? null : serialize(from),
      to: to === undefined ? null : serialize(to),
    };
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Who did it
// ─────────────────────────────────────────────────────────────────────────────

export type AuditActor = {
  actorId: string | null;
  actorLabel: string;
  actorEmail: string | null;
  organizationId: string | null;
  schoolId: string | null;
  schoolYearId: string | null;
};

const NO_ACTOR: AuditActor = {
  actorId: null,
  actorLabel: "system",
  actorEmail: null,
  organizationId: null,
  schoolId: null,
  schoolYearId: null,
};

/**
 * The signed-in user, read from the DAL at the moment of the write.
 *
 * Imported dynamically because `lib/dal.ts` imports `lib/db.ts`, which imports
 * this file — a static import would be a cycle at module load. At call time
 * everything is initialised and `getAuthContext` is React-cached per request,
 * so the action that already authorized itself pays nothing to be identified.
 *
 * Outside a request — a script, a background job — there is no session to read
 * and the lookup throws. That is not an error: the write simply had no author.
 */
async function currentActor(): Promise<AuditActor> {
  try {
    const { getAuthContext, displayName } = await import("@/lib/dal");
    const context = await getAuthContext();
    if (!context) return NO_ACTOR;

    return {
      actorId: context.user.id,
      actorLabel: displayName(context.user),
      actorEmail: context.user.email,
      organizationId: context.user.organizationId,
      schoolId: context.currentSchool?.id ?? null,
      schoolYearId: context.currentSchoolYear?.id ?? null,
    };
  } catch {
    return NO_ACTOR;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Writing the entry
// ─────────────────────────────────────────────────────────────────────────────

export type AuditEvent = {
  action: ActivityAction;
  entity: string;
  entityId?: string | null;
  entityLabel?: string | null;
  changes?: ChangeSet | null;
  metadata?: Record<string, unknown> | null;
  /** Supplied when the act has an author the session cannot name — a login. */
  actor?: Partial<AuditActor>;
};

/**
 * Appends one entry.
 *
 * Never throws. A trail that can take the app down with it would be turned off
 * within the week, and losing a line is a smaller failure than refusing a
 * payment because the line could not be written. Failures go to the server log,
 * which is where an operator would look for them.
 */
async function append(
  base: BaseClient,
  event: AuditEvent,
  resolved?: AuditActor,
): Promise<void> {
  try {
    const actor = { ...(resolved ?? (await currentActor())), ...event.actor };

    await base.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        schoolId: actor.schoolId,
        schoolYearId: actor.schoolYearId,
        actorId: actor.actorId,
        actorLabel: actor.actorLabel,
        actorEmail: actor.actorEmail,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId ?? null,
        entityLabel: event.entityLabel ?? null,
        changes: event.changes ? JSON.stringify(event.changes) : null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });
  } catch (error) {
    console.error("Audit trail write failed:", error);
  }
}

/**
 * Records something the client extension cannot see, because it changed no row:
 * a login, a refused password, a permission denied.
 *
 * Uses its own client — `lib/db.ts` exports the extended one, and an entry about
 * an entry is not wanted.
 */
export async function recordEvent(event: AuditEvent): Promise<void> {
  const { auditClient } = await import("@/lib/db");
  await append(auditClient, event);
}

// ─────────────────────────────────────────────────────────────────────────────
//  The extension
// ─────────────────────────────────────────────────────────────────────────────

/** `Student` → `student`, which is what the delegate is called. */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type Delegate = {
  findFirst: (args: unknown) => Promise<Row | null>;
  findUnique: (args: unknown) => Promise<Row | null>;
  findMany: (args: unknown) => Promise<Row[]>;
};

function delegateFor(base: BaseClient, model: string): Delegate | null {
  const delegate = (base as unknown as Record<string, unknown>)[
    delegateName(model)
  ];
  return delegate ? (delegate as Delegate) : null;
}

/**
 * Reads the rows an operation is about to change, so the entry can say what it
 * changed *from*.
 *
 * `findFirst` rather than `findUnique` for an update or a delete: the app's own
 * security rule is to scope a write by more than its id
 * (`where: { id, organizationId }`), and that where clause is not a unique
 * input. An upsert is the opposite case — its `where` *is* a unique input, and
 * a compound one (`{ schoolClassId_timeSlotId_bookingKey: {…} }`) is an
 * argument `findFirst` rejects outright. Sending it there cost a thrown query
 * on every upsert in the app: swallowed by the catch below, so nothing broke
 * visibly, but the entry lost its "before" and the write was recorded as if it
 * had created the row. It also logged a full Prisma error each time, which is
 * what pushed `applyTimetableDraft` past its transaction timeout.
 *
 * Bulk operations read ids only, and only up to a cap — a `deleteMany` across a
 * whole year must not pull the year into memory.
 */
async function readBefore(
  base: BaseClient,
  model: string,
  operation: string,
  args: { where?: unknown },
): Promise<{ before: Row | null; bulk: Row[] }> {
  const delegate = delegateFor(base, model);
  if (!delegate || !args?.where) return { before: null, bulk: [] };

  try {
    if (operation === "upsert") {
      return { before: await delegate.findUnique({ where: args.where }), bulk: [] };
    }
    if (operation === "update" || operation === "delete") {
      return { before: await delegate.findFirst({ where: args.where }), bulk: [] };
    }
    if (operation.startsWith("updateMany") || operation === "deleteMany") {
      return {
        before: null,
        bulk: await delegate.findMany({ where: args.where, take: BULK_ID_CAP }),
      };
    }
  } catch {
    // A where clause the delegate cannot read is not a reason to block a write.
  }

  return { before: null, bulk: [] };
}

function firstRow(result: unknown): Row | null {
  if (!result || typeof result !== "object") return null;
  if (Array.isArray(result)) return (result[0] as Row) ?? null;
  if ("count" in (result as Row)) return null;
  return result as Row;
}

/**
 * Builds the `$extends` argument.
 *
 * Takes the unextended client so the trail's own inserts and its "before" reads
 * do not come back through the extension.
 */
export function auditExtension(base: BaseClient) {
  return {
    name: "audit",
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          const action = WRITE_OPERATIONS[operation];
          if (!action || UNAUDITED_MODELS.includes(model)) return query(args);

          const { before, bulk } = await readBefore(base, model, operation, args);

          const result = await query(args);

          const event = buildEvent(
            model,
            operation,
            action,
            args,
            before,
            bulk,
            result,
          );

          // An update that changed nothing is not an event. Forms post every
          // field they render, so "saved without editing anything" is a common
          // way to use this app and a common way to fill a trail with noise.
          if (event.action === "UPDATE" && !event.changes) return result;

          // Awaited rather than left floating: a promise dropped at the end of
          // a request is a line of the trail lost, and on a pooled connection
          // it can outlive the transaction it belongs to.
          await append(base, event);

          return result;
        },
      },
    },
  };
}

function buildEvent(
  model: string,
  operation: string,
  action: ActivityAction,
  args: Record<string, unknown>,
  before: Row | null,
  bulk: Row[],
  result: unknown,
): AuditEvent {
  const after = firstRow(result);
  const count =
    result && typeof result === "object" && "count" in (result as Row)
      ? Number((result as Row).count)
      : null;

  // A bulk operation has no single row to be about, so it records how many rows
  // it touched and which ones, up to the cap. `createMany` has no "before" to
  // have read, so its ids come from what it returned — when it returned any.
  if (action.endsWith("_MANY")) {
    const resultRows: Row[] = Array.isArray(result) ? (result as Row[]) : [];
    const ids = (bulk.length > 0 ? bulk : resultRows)
      .map((row) => (typeof row.id === "string" ? row.id : null))
      .filter((id): id is string => id !== null);

    return {
      action,
      entity: model,
      entityId: null,
      entityLabel: null,
      changes: null,
      metadata: {
        count: count ?? (resultRows.length || ids.length),
        ...(ids.length > 0
          ? { ids: ids.slice(0, BULK_ID_CAP), truncated: ids.length >= BULK_ID_CAP }
          : {}),
        ...(operation.startsWith("update") && args.data
          ? { data: serializeData(args.data) }
          : {}),
      },
    };
  }

  const row = after ?? before;
  const scope = scopeOf(row);

  // An upsert reads as a creation when there was nothing there before.
  const resolvedAction: ActivityAction =
    operation === "upsert" && !before ? "CREATE" : action;

  return {
    action: resolvedAction,
    entity: model,
    entityId: typeof row?.id === "string" ? row.id : null,
    entityLabel: labelOf(row),
    // A deletion diffs against nothing: the entry carries the row as it last
    // read, which is the only copy of it that will survive.
    changes:
      resolvedAction === "DELETE" ? diff(before, null) : diff(before, after),
    metadata: null,
    actor: {
      // The row's own scope wins over the actor's header: an administrator
      // editing school B's data while school A is selected must file under B.
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
      ...(scope.schoolYearId ? { schoolYearId: scope.schoolYearId } : {}),
    },
  };
}

/** The `data` of a bulk update, flattened enough to be readable. */
function serializeData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const entries = Object.entries(data as Row)
    .filter(([field]) => !IGNORED_FIELDS.includes(field))
    .map(([field, value]) => [
      field,
      isRedacted(field) ? "•••" : serialize(value),
    ]);
  return Object.fromEntries(entries);
}

/** Reads a stored `changes` column back. Never throws on malformed JSON. */
export function parseChanges(raw: string | null): ChangeSet | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChangeSet;
  } catch {
    return null;
  }
}

/** Reads a stored `metadata` column back. */
export function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
