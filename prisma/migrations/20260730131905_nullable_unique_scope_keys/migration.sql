/*
  Warnings:

  - Added the required column `scopeKey` to the `level_offerings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scopeKey` to the `level_subjects` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scopeKey` to the `teaching_assignments` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_level_offerings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "trackId" TEXT,
    "plannedCapacity" INTEGER,
    "tuitionCentimes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scopeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "level_offerings_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_offerings_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "level_offerings_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_level_offerings" ("createdAt", "id", "isActive", "levelId", "plannedCapacity", "schoolYearId", "trackId", "tuitionCentimes", "updatedAt") SELECT "createdAt", "id", "isActive", "levelId", "plannedCapacity", "schoolYearId", "trackId", "tuitionCentimes", "updatedAt" FROM "level_offerings";
DROP TABLE "level_offerings";
ALTER TABLE "new_level_offerings" RENAME TO "level_offerings";
CREATE INDEX "level_offerings_schoolYearId_idx" ON "level_offerings"("schoolYearId");
CREATE INDEX "level_offerings_levelId_idx" ON "level_offerings"("levelId");
CREATE INDEX "level_offerings_trackId_idx" ON "level_offerings"("trackId");
CREATE UNIQUE INDEX "level_offerings_schoolYearId_levelId_scopeKey_key" ON "level_offerings"("schoolYearId", "levelId", "scopeKey");
CREATE TABLE "new_level_subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "levelId" TEXT NOT NULL,
    "trackId" TEXT,
    "subjectId" TEXT NOT NULL,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "weeklyMinutes" INTEGER,
    "isGraded" BOOLEAN NOT NULL DEFAULT true,
    "isEliminatory" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "scopeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "level_subjects_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_subjects_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_level_subjects" ("coefficient", "createdAt", "id", "isEliminatory", "isGraded", "levelId", "position", "subjectId", "trackId", "updatedAt", "weeklyMinutes") SELECT "coefficient", "createdAt", "id", "isEliminatory", "isGraded", "levelId", "position", "subjectId", "trackId", "updatedAt", "weeklyMinutes" FROM "level_subjects";
DROP TABLE "level_subjects";
ALTER TABLE "new_level_subjects" RENAME TO "level_subjects";
CREATE INDEX "level_subjects_levelId_idx" ON "level_subjects"("levelId");
CREATE INDEX "level_subjects_trackId_idx" ON "level_subjects"("trackId");
CREATE INDEX "level_subjects_subjectId_idx" ON "level_subjects"("subjectId");
CREATE UNIQUE INDEX "level_subjects_levelId_subjectId_scopeKey_key" ON "level_subjects"("levelId", "subjectId", "scopeKey");
CREATE TABLE "new_teaching_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolClassId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weeklyMinutes" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "scopeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "teaching_assignments_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teaching_assignments_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teaching_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "teaching_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_teaching_assignments" ("classGroupId", "createdAt", "id", "isPrimary", "schoolClassId", "subjectId", "teacherId", "updatedAt", "weeklyMinutes") SELECT "classGroupId", "createdAt", "id", "isPrimary", "schoolClassId", "subjectId", "teacherId", "updatedAt", "weeklyMinutes" FROM "teaching_assignments";
DROP TABLE "teaching_assignments";
ALTER TABLE "new_teaching_assignments" RENAME TO "teaching_assignments";
CREATE INDEX "teaching_assignments_schoolClassId_idx" ON "teaching_assignments"("schoolClassId");
CREATE INDEX "teaching_assignments_classGroupId_idx" ON "teaching_assignments"("classGroupId");
CREATE INDEX "teaching_assignments_subjectId_idx" ON "teaching_assignments"("subjectId");
CREATE INDEX "teaching_assignments_teacherId_idx" ON "teaching_assignments"("teacherId");
CREATE UNIQUE INDEX "teaching_assignments_schoolClassId_subjectId_teacherId_scopeKey_key" ON "teaching_assignments"("schoolClassId", "subjectId", "teacherId", "scopeKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
