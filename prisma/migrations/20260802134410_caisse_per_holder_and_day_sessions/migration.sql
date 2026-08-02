-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cash_registers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "holderId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cash_registers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_registers_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cash_registers" ("code", "createdAt", "id", "isActive", "name", "nameAr", "notes", "position", "schoolId", "updatedAt") SELECT "code", "createdAt", "id", "isActive", "name", "nameAr", "notes", "position", "schoolId", "updatedAt" FROM "cash_registers";
DROP TABLE "cash_registers";
ALTER TABLE "new_cash_registers" RENAME TO "cash_registers";
CREATE UNIQUE INDEX "cash_registers_holderId_key" ON "cash_registers"("holderId");
CREATE INDEX "cash_registers_schoolId_idx" ON "cash_registers"("schoolId");
CREATE UNIQUE INDEX "cash_registers_schoolId_code_key" ON "cash_registers"("schoolId", "code");
CREATE TABLE "new_cash_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashRegisterId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloatCentimes" INTEGER NOT NULL DEFAULT 0,
    "closedById" TEXT,
    "closedAt" DATETIME,
    "countedCentimes" INTEGER,
    "expectedCentimes" INTEGER,
    "varianceCentimes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "wasAutoClosed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "openKey" TEXT,
    CONSTRAINT "cash_sessions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cash_sessions" ("cashRegisterId", "closedAt", "closedById", "countedCentimes", "createdAt", "expectedCentimes", "id", "notes", "openKey", "openedAt", "openedById", "openingFloatCentimes", "status", "updatedAt", "varianceCentimes") SELECT "cashRegisterId", "closedAt", "closedById", "countedCentimes", "createdAt", "expectedCentimes", "id", "notes", "openKey", "openedAt", "openedById", "openingFloatCentimes", "status", "updatedAt", "varianceCentimes" FROM "cash_sessions";
DROP TABLE "cash_sessions";
ALTER TABLE "new_cash_sessions" RENAME TO "cash_sessions";
CREATE UNIQUE INDEX "cash_sessions_openKey_key" ON "cash_sessions"("openKey");
CREATE INDEX "cash_sessions_cashRegisterId_idx" ON "cash_sessions"("cashRegisterId");
CREATE INDEX "cash_sessions_status_idx" ON "cash_sessions"("status");
CREATE INDEX "cash_sessions_openedAt_idx" ON "cash_sessions"("openedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

