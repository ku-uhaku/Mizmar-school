-- AlterTable
ALTER TABLE "levels" ADD COLUMN "massarCode" TEXT;

-- AlterTable
ALTER TABLE "tracks" ADD COLUMN "massarCode" TEXT;

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "kind" TEXT NOT NULL,
    "percentBps" INTEGER,
    "amountCentimes" INTEGER,
    "reason" TEXT NOT NULL DEFAULT 'OTHER',
    "feeTypeId" TEXT,
    "isStackable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "discounts_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "discounts_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "fee_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fee_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "levelId" TEXT,
    "amountCentimes" INTEGER NOT NULL,
    "instalmentCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "scopeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fee_rates_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fee_rates_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "fee_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fee_rates_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fee_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "billingCycle" TEXT NOT NULL DEFAULT 'ANNUAL',
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fee_types_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_level_offerings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "trackId" TEXT,
    "plannedCapacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scopeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "level_offerings_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_offerings_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "level_offerings_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_level_offerings" ("createdAt", "id", "isActive", "levelId", "plannedCapacity", "schoolYearId", "scopeKey", "trackId", "updatedAt") SELECT "createdAt", "id", "isActive", "levelId", "plannedCapacity", "schoolYearId", "scopeKey", "trackId", "updatedAt" FROM "level_offerings";
DROP TABLE "level_offerings";
ALTER TABLE "new_level_offerings" RENAME TO "level_offerings";
CREATE INDEX "level_offerings_schoolYearId_idx" ON "level_offerings"("schoolYearId");
CREATE INDEX "level_offerings_levelId_idx" ON "level_offerings"("levelId");
CREATE INDEX "level_offerings_trackId_idx" ON "level_offerings"("trackId");
CREATE UNIQUE INDEX "level_offerings_schoolYearId_levelId_scopeKey_key" ON "level_offerings"("schoolYearId", "levelId", "scopeKey");
CREATE TABLE "new_subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "shortName" TEXT,
    "massarCode" TEXT,
    "parentId" TEXT,
    "colorHex" TEXT,
    "isLanguage" BOOLEAN NOT NULL DEFAULT false,
    "requiresLab" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subjects_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_subjects" ("code", "colorHex", "createdAt", "id", "isActive", "isLanguage", "name", "nameAr", "requiresLab", "schoolId", "shortName", "updatedAt") SELECT "code", "colorHex", "createdAt", "id", "isActive", "isLanguage", "name", "nameAr", "requiresLab", "schoolId", "shortName", "updatedAt" FROM "subjects";
DROP TABLE "subjects";
ALTER TABLE "new_subjects" RENAME TO "subjects";
CREATE INDEX "subjects_schoolId_idx" ON "subjects"("schoolId");
CREATE INDEX "subjects_parentId_idx" ON "subjects"("parentId");
CREATE UNIQUE INDEX "subjects_schoolId_code_key" ON "subjects"("schoolId", "code");
CREATE UNIQUE INDEX "subjects_schoolId_massarCode_key" ON "subjects"("schoolId", "massarCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "discounts_schoolYearId_idx" ON "discounts"("schoolYearId");

-- CreateIndex
CREATE INDEX "discounts_feeTypeId_idx" ON "discounts"("feeTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_schoolYearId_code_key" ON "discounts"("schoolYearId", "code");

-- CreateIndex
CREATE INDEX "fee_rates_schoolYearId_idx" ON "fee_rates"("schoolYearId");

-- CreateIndex
CREATE INDEX "fee_rates_feeTypeId_idx" ON "fee_rates"("feeTypeId");

-- CreateIndex
CREATE INDEX "fee_rates_levelId_idx" ON "fee_rates"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_rates_schoolYearId_feeTypeId_scopeKey_key" ON "fee_rates"("schoolYearId", "feeTypeId", "scopeKey");

-- CreateIndex
CREATE INDEX "fee_types_schoolId_idx" ON "fee_types"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_types_schoolId_code_key" ON "fee_types"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "levels_schoolId_massarCode_key" ON "levels"("schoolId", "massarCode");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_levelId_massarCode_key" ON "tracks"("levelId", "massarCode");

