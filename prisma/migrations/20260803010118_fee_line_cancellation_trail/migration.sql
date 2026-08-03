-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_enrollment_fees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "feeRateId" TEXT,
    "periodIndex" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "dueMonth" INTEGER NOT NULL,
    "dueYear" INTEGER NOT NULL,
    "baseAmountCentimes" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "discountCentimes" INTEGER NOT NULL DEFAULT 0,
    "discountId" TEXT,
    "amountCentimes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "enrollment_fees_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollment_fees_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "fee_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "enrollment_fees_feeRateId_fkey" FOREIGN KEY ("feeRateId") REFERENCES "fee_rates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "enrollment_fees_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "discounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "enrollment_fees_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_enrollment_fees" ("amountCentimes", "baseAmountCentimes", "createdAt", "discountBps", "discountCentimes", "discountId", "dueDate", "dueMonth", "dueYear", "enrollmentId", "feeRateId", "feeTypeId", "id", "notes", "periodIndex", "status", "updatedAt") SELECT "amountCentimes", "baseAmountCentimes", "createdAt", "discountBps", "discountCentimes", "discountId", "dueDate", "dueMonth", "dueYear", "enrollmentId", "feeRateId", "feeTypeId", "id", "notes", "periodIndex", "status", "updatedAt" FROM "enrollment_fees";
DROP TABLE "enrollment_fees";
ALTER TABLE "new_enrollment_fees" RENAME TO "enrollment_fees";
CREATE INDEX "enrollment_fees_enrollmentId_idx" ON "enrollment_fees"("enrollmentId");
CREATE INDEX "enrollment_fees_feeTypeId_idx" ON "enrollment_fees"("feeTypeId");
CREATE INDEX "enrollment_fees_feeRateId_idx" ON "enrollment_fees"("feeRateId");
CREATE INDEX "enrollment_fees_discountId_idx" ON "enrollment_fees"("discountId");
CREATE INDEX "enrollment_fees_cancelledById_idx" ON "enrollment_fees"("cancelledById");
CREATE INDEX "enrollment_fees_dueYear_dueMonth_idx" ON "enrollment_fees"("dueYear", "dueMonth");
CREATE UNIQUE INDEX "enrollment_fees_enrollmentId_feeTypeId_periodIndex_key" ON "enrollment_fees"("enrollmentId", "feeTypeId", "periodIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

