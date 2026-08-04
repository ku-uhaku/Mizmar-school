-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_fee_rates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "levelId" TEXT,
    "amountCentimes" INTEGER NOT NULL,
    "instalmentCount" INTEGER,
    "perInstalment" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "scopeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fee_rates_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fee_rates_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "fee_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fee_rates_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_fee_rates" ("amountCentimes", "createdAt", "feeTypeId", "id", "instalmentCount", "isActive", "levelId", "notes", "schoolYearId", "scopeKey", "updatedAt") SELECT "amountCentimes", "createdAt", "feeTypeId", "id", "instalmentCount", "isActive", "levelId", "notes", "schoolYearId", "scopeKey", "updatedAt" FROM "fee_rates";
DROP TABLE "fee_rates";
ALTER TABLE "new_fee_rates" RENAME TO "fee_rates";
CREATE INDEX "fee_rates_schoolYearId_idx" ON "fee_rates"("schoolYearId");
CREATE INDEX "fee_rates_feeTypeId_idx" ON "fee_rates"("feeTypeId");
CREATE INDEX "fee_rates_levelId_idx" ON "fee_rates"("levelId");
CREATE UNIQUE INDEX "fee_rates_schoolYearId_feeTypeId_scopeKey_key" ON "fee_rates"("schoolYearId", "feeTypeId", "scopeKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

