-- CreateTable
CREATE TABLE "enrollment_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "startsOn" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "enrollment_options_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollment_options_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "fee_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);


-- ─────────────────────────────────────────────────────────────────────────────
--  Carry the two hardcoded opt-ins over to the new table.
--
--  This runs BEFORE the RedefineTables block below, which is what drops
--  `usesTransport`, `usesCanteen` and their start months. Reading them
--  afterwards would read nothing and every subscribed family would silently
--  stop being billed for the bus.
--
--  Exactly one fee type per school and kind is chosen, by the same
--  (position, code) order the catalogue is listed in, so a school that has
--  somehow declared two TRANSPORT charges subscribes its riders to one of them
--  rather than to both. Mandatory charges are excluded: they are billed to
--  everyone already, and a subscription to one would mean nothing.
--
--  ── A flag with nothing to point at is dropped, and that is correct ─────────
--  The old columns were decoupled from the catalogue, so a pupil could be
--  flagged as taking the bus at a school that has no TRANSPORT charge at all.
--  Such a flag already billed nothing — no fee type means no rate, which means
--  `buildScheduleLines` raised no line — so there is nothing for the new row to
--  carry and the `IS NOT NULL` guard below leaves it behind. Verified against
--  the development database before this was written: the one such enrolment had
--  thirteen fee lines, none of them transport, and no bus seat.
--
--  The ids are hex rather than cuid — `randomblob` is what SQLite has, the
--  column is only ever a key, and nothing reads a meaning out of it.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "enrollment_options" ("id", "enrollmentId", "feeTypeId", "startsOn", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(16))),
    e."id",
    (
        SELECT f."id" FROM "fee_types" f
        JOIN "school_years" y ON y."id" = e."schoolYearId"
        WHERE f."schoolId" = y."schoolId"
          AND f."kind" = 'TRANSPORT'
          AND f."isMandatory" = false
        ORDER BY f."position" ASC, f."code" ASC
        LIMIT 1
    ),
    e."transportStartsOn",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "enrollments" e
WHERE e."usesTransport" = true
  AND (
        SELECT f."id" FROM "fee_types" f
        JOIN "school_years" y ON y."id" = e."schoolYearId"
        WHERE f."schoolId" = y."schoolId"
          AND f."kind" = 'TRANSPORT'
          AND f."isMandatory" = false
        ORDER BY f."position" ASC, f."code" ASC
        LIMIT 1
      ) IS NOT NULL;

INSERT INTO "enrollment_options" ("id", "enrollmentId", "feeTypeId", "startsOn", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(16))),
    e."id",
    (
        SELECT f."id" FROM "fee_types" f
        JOIN "school_years" y ON y."id" = e."schoolYearId"
        WHERE f."schoolId" = y."schoolId"
          AND f."kind" = 'CANTEEN'
          AND f."isMandatory" = false
        ORDER BY f."position" ASC, f."code" ASC
        LIMIT 1
    ),
    e."canteenStartsOn",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "enrollments" e
WHERE e."usesCanteen" = true
  AND (
        SELECT f."id" FROM "fee_types" f
        JOIN "school_years" y ON y."id" = e."schoolYearId"
        WHERE f."schoolId" = y."schoolId"
          AND f."kind" = 'CANTEEN'
          AND f."isMandatory" = false
        ORDER BY f."position" ASC, f."code" ASC
        LIMIT 1
      ) IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_enrollments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "levelOfferingId" TEXT NOT NULL,
    "schoolClassId" TEXT,
    "classGroupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftOn" DATETIME,
    "isRepeating" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollments_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollments_levelOfferingId_fkey" FOREIGN KEY ("levelOfferingId") REFERENCES "level_offerings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "enrollments_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "enrollments_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_enrollments" ("classGroupId", "createdAt", "enrolledOn", "id", "isRepeating", "leftOn", "levelOfferingId", "notes", "schoolClassId", "schoolYearId", "status", "studentId", "updatedAt") SELECT "classGroupId", "createdAt", "enrolledOn", "id", "isRepeating", "leftOn", "levelOfferingId", "notes", "schoolClassId", "schoolYearId", "status", "studentId", "updatedAt" FROM "enrollments";
DROP TABLE "enrollments";
ALTER TABLE "new_enrollments" RENAME TO "enrollments";
CREATE INDEX "enrollments_schoolYearId_idx" ON "enrollments"("schoolYearId");
CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");
CREATE INDEX "enrollments_levelOfferingId_idx" ON "enrollments"("levelOfferingId");
CREATE INDEX "enrollments_schoolClassId_idx" ON "enrollments"("schoolClassId");
CREATE INDEX "enrollments_classGroupId_idx" ON "enrollments"("classGroupId");
CREATE INDEX "enrollments_schoolYearId_status_idx" ON "enrollments"("schoolYearId", "status");
CREATE UNIQUE INDEX "enrollments_studentId_schoolYearId_key" ON "enrollments"("studentId", "schoolYearId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "enrollment_options_enrollmentId_idx" ON "enrollment_options"("enrollmentId");

-- CreateIndex
CREATE INDEX "enrollment_options_feeTypeId_idx" ON "enrollment_options"("feeTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_options_enrollmentId_feeTypeId_key" ON "enrollment_options"("enrollmentId", "feeTypeId");

