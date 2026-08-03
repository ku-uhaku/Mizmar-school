-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "familyId" TEXT,
    "code" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCentimes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "cashSessionId" TEXT,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("cancelReason", "cancelledAt", "cashSessionId", "code", "createdAt", "createdById", "familyId", "id", "notes", "paidAt", "schoolId", "schoolYearId", "status", "totalCentimes", "updatedAt") SELECT "cancelReason", "cancelledAt", "cashSessionId", "code", "createdAt", "createdById", "familyId", "id", "notes", "paidAt", "schoolId", "schoolYearId", "status", "totalCentimes", "updatedAt" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
CREATE INDEX "payments_schoolId_idx" ON "payments"("schoolId");
CREATE INDEX "payments_schoolYearId_idx" ON "payments"("schoolYearId");
CREATE INDEX "payments_familyId_idx" ON "payments"("familyId");
CREATE INDEX "payments_cashSessionId_idx" ON "payments"("cashSessionId");
CREATE INDEX "payments_schoolId_paidAt_idx" ON "payments"("schoolId", "paidAt");
CREATE INDEX "payments_schoolId_status_idx" ON "payments"("schoolId", "status");
CREATE INDEX "payments_cancelledById_idx" ON "payments"("cancelledById");
CREATE UNIQUE INDEX "payments_schoolId_code_key" ON "payments"("schoolId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

