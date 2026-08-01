-- AlterTable
ALTER TABLE "timetable_entries" ADD COLUMN "fromWeek" INTEGER;
ALTER TABLE "timetable_entries" ADD COLUMN "toWeek" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_school_weeks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startsOn" DATETIME NOT NULL,
    "endsOn" DATETIME NOT NULL,
    "isTeaching" BOOLEAN NOT NULL DEFAULT true,
    "parity" TEXT NOT NULL DEFAULT 'A',
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "school_weeks_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_school_weeks" ("createdAt", "endsOn", "id", "label", "number", "parity", "schoolYearId", "startsOn", "updatedAt") SELECT "createdAt", "endsOn", "id", "label", "number", "parity", "schoolYearId", "startsOn", "updatedAt" FROM "school_weeks";
DROP TABLE "school_weeks";
ALTER TABLE "new_school_weeks" RENAME TO "school_weeks";
CREATE INDEX "school_weeks_schoolYearId_idx" ON "school_weeks"("schoolYearId");
CREATE INDEX "school_weeks_schoolYearId_startsOn_idx" ON "school_weeks"("schoolYearId", "startsOn");
CREATE UNIQUE INDEX "school_weeks_schoolYearId_number_key" ON "school_weeks"("schoolYearId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "timetable_entries_schoolClassId_fromWeek_idx" ON "timetable_entries"("schoolClassId", "fromWeek");

