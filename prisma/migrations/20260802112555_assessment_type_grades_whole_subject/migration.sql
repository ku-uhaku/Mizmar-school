-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assessment_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "defaultCoefficient" INTEGER NOT NULL DEFAULT 1,
    "defaultMaxScore" INTEGER NOT NULL DEFAULT 20,
    "countsTowardAverage" BOOLEAN NOT NULL DEFAULT true,
    "gradesWholeSubject" BOOLEAN NOT NULL DEFAULT false,
    "allowTeacherCreate" BOOLEAN NOT NULL DEFAULT false,
    "colorHex" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assessment_types_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_assessment_types" ("allowTeacherCreate", "code", "colorHex", "countsTowardAverage", "createdAt", "defaultCoefficient", "defaultMaxScore", "id", "isActive", "name", "nameAr", "position", "schoolId", "updatedAt") SELECT "allowTeacherCreate", "code", "colorHex", "countsTowardAverage", "createdAt", "defaultCoefficient", "defaultMaxScore", "id", "isActive", "name", "nameAr", "position", "schoolId", "updatedAt" FROM "assessment_types";
DROP TABLE "assessment_types";
ALTER TABLE "new_assessment_types" RENAME TO "assessment_types";
CREATE INDEX "assessment_types_schoolId_idx" ON "assessment_types"("schoolId");
CREATE UNIQUE INDEX "assessment_types_schoolId_code_key" ON "assessment_types"("schoolId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

