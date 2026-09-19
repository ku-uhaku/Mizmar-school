import { normalisePhone } from "@/modules/messaging/phone";

/**
 * Which late households a campaign is addressed to. Pure and isomorphic: the
 * screen applies it to draw the list, and the action applies the same function
 * to the same data to decide who is actually sent to — so what the manager saw
 * and what went out cannot drift.
 */
export type ReminderFilters = {
  /** Only households whose overdue amount is at least this, in centimes. */
  minCentimes: number;
  levelOfferingId: string | null;
  classId: string | null;
  search: string;
};

export const NO_FILTERS: ReminderFilters = {
  minCentimes: 0,
  levelOfferingId: null,
  classId: null,
  search: "",
};

/** Reads filters from untrusted JSON, falling back to "no filter" per field. */
export function parseFilters(raw: unknown): ReminderFilters {
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  const min = Number(value.minCentimes);
  return {
    minCentimes: Number.isFinite(min) && min > 0 ? Math.floor(min) : 0,
    levelOfferingId:
      typeof value.levelOfferingId === "string" && value.levelOfferingId
        ? value.levelOfferingId
        : null,
    classId:
      typeof value.classId === "string" && value.classId ? value.classId : null,
    search: typeof value.search === "string" ? value.search.slice(0, 100) : "",
  };
}

export type FilterableTarget = {
  familyName: string;
  familyCode: string;
  contactName: string;
  overdueCentimes: number;
  levelOfferingIds: string[];
  classIds: string[];
};

export function matchesFilters(
  target: FilterableTarget,
  filters: ReminderFilters,
): boolean {
  if (target.overdueCentimes < filters.minCentimes) return false;
  if (
    filters.levelOfferingId &&
    !target.levelOfferingIds.includes(filters.levelOfferingId)
  ) {
    return false;
  }
  if (filters.classId && !target.classIds.includes(filters.classId)) {
    return false;
  }
  const needle = filters.search.trim().toLowerCase();
  if (needle) {
    const haystack =
      `${target.familyName} ${target.familyCode} ${target.contactName}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/** Why a household on the list will not be messaged, or null when it will. */
export type SkipReason = "NO_PHONE" | "COOL_DOWN";

export function phoneOf(raw: string | null): string | null {
  return normalisePhone(raw);
}
