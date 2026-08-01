-- Backfills TimetableEntry.bookingKey after `weekParity`, `fromWeek` and
-- `toWeek` joined it.
--
-- The key mirrors the nullable columns so the no-double-booking index can fire
-- (see lib/db-keys.ts). Rows written before those three columns existed carry a
-- shorter key, so they no longer match what `bookingKeyOf` now produces — the
-- unique index stopped covering them, and an upsert against a stale key wrote a
-- second lesson into a slot that already had one.
--
-- Order matters: the duplicates have to go before the keys are recomputed, or
-- the UPDATE would collide with the very index it is restoring.

-- 1. Drop the duplicates the stale keys let through, keeping the oldest row of
--    each genuine lesson. Rows that legitimately differ — another term, another
--    group, another half of the rotation — are grouped apart and all survive.
DELETE FROM "timetable_entries"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "timetable_entries"
  GROUP BY
    "schoolClassId",
    "timeSlotId",
    "classGroupId",
    "termId",
    "weekParity",
    "fromWeek",
    "toWeek"
);

-- 2. Recompute every key, exactly as `bookingKeyOf` does: the parts joined with
--    ":", with "" standing in for null.
UPDATE "timetable_entries"
SET "bookingKey" =
  COALESCE("classGroupId", '') || ':' ||
  COALESCE("termId", '') || ':' ||
  COALESCE("weekParity", 'ALL') || ':' ||
  COALESCE(CAST("fromWeek" AS TEXT), '') || ':' ||
  COALESCE(CAST("toWeek" AS TEXT), '');
