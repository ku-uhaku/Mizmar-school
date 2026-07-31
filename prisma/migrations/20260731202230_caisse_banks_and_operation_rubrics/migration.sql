-- CreateTable
CREATE TABLE "banks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "agency" TEXT,
    "accountNumber" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "banks_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operation_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OUT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "operation_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operation_motifs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "categoryId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "operation_motifs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "operation_motifs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "operation_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operation_subcategories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "operation_subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "operation_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cash_operations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "kind" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountCentimes" INTEGER NOT NULL,
    "cashImpactCentimes" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "reversesOperationId" TEXT,
    "paymentId" TEXT,
    "expenseCategoryId" TEXT,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "motifId" TEXT,
    "beneficiaryStaffId" TEXT,
    "beneficiaryName" TEXT,
    "transferGroupId" TEXT,
    "counterpartRegisterId" TEXT,
    "bankId" TEXT,
    "bankAccountLabel" TEXT,
    "chequeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cash_operations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_reversesOperationId_fkey" FOREIGN KEY ("reversesOperationId") REFERENCES "cash_operations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "expense_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "operation_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "operation_subcategories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_motifId_fkey" FOREIGN KEY ("motifId") REFERENCES "operation_motifs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_beneficiaryStaffId_fkey" FOREIGN KEY ("beneficiaryStaffId") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_counterpartRegisterId_fkey" FOREIGN KEY ("counterpartRegisterId") REFERENCES "cash_registers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "cheques" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cash_operations" ("amountCentimes", "bankAccountLabel", "beneficiaryName", "beneficiaryStaffId", "cashImpactCentimes", "cashSessionId", "chequeId", "counterpartRegisterId", "createdAt", "createdById", "expenseCategoryId", "id", "kind", "label", "method", "occurredAt", "paymentId", "reference", "reversesOperationId", "schoolId", "status", "transferGroupId", "updatedAt") SELECT "amountCentimes", "bankAccountLabel", "beneficiaryName", "beneficiaryStaffId", "cashImpactCentimes", "cashSessionId", "chequeId", "counterpartRegisterId", "createdAt", "createdById", "expenseCategoryId", "id", "kind", "label", "method", "occurredAt", "paymentId", "reference", "reversesOperationId", "schoolId", "status", "transferGroupId", "updatedAt" FROM "cash_operations";
DROP TABLE "cash_operations";
ALTER TABLE "new_cash_operations" RENAME TO "cash_operations";
CREATE UNIQUE INDEX "cash_operations_reversesOperationId_key" ON "cash_operations"("reversesOperationId");
CREATE UNIQUE INDEX "cash_operations_paymentId_key" ON "cash_operations"("paymentId");
CREATE INDEX "cash_operations_schoolId_idx" ON "cash_operations"("schoolId");
CREATE INDEX "cash_operations_beneficiaryStaffId_idx" ON "cash_operations"("beneficiaryStaffId");
CREATE INDEX "cash_operations_cashSessionId_idx" ON "cash_operations"("cashSessionId");
CREATE INDEX "cash_operations_expenseCategoryId_idx" ON "cash_operations"("expenseCategoryId");
CREATE INDEX "cash_operations_categoryId_idx" ON "cash_operations"("categoryId");
CREATE INDEX "cash_operations_subcategoryId_idx" ON "cash_operations"("subcategoryId");
CREATE INDEX "cash_operations_motifId_idx" ON "cash_operations"("motifId");
CREATE INDEX "cash_operations_bankId_idx" ON "cash_operations"("bankId");
CREATE INDEX "cash_operations_counterpartRegisterId_idx" ON "cash_operations"("counterpartRegisterId");
CREATE INDEX "cash_operations_chequeId_idx" ON "cash_operations"("chequeId");
CREATE INDEX "cash_operations_createdById_idx" ON "cash_operations"("createdById");
CREATE INDEX "cash_operations_transferGroupId_idx" ON "cash_operations"("transferGroupId");
CREATE INDEX "cash_operations_schoolId_occurredAt_idx" ON "cash_operations"("schoolId", "occurredAt");
CREATE INDEX "cash_operations_schoolId_kind_status_idx" ON "cash_operations"("schoolId", "kind", "status");
CREATE TABLE "new_cheques" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'INCOMING',
    "number" TEXT NOT NULL,
    "bankId" TEXT,
    "bankName" TEXT,
    "drawerName" TEXT,
    "amountCentimes" INTEGER NOT NULL,
    "issuedOn" DATETIME,
    "dueOn" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "depositedOn" DATETIME,
    "settledOn" DATETIME,
    "bounceReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cheques_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cheques_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_cheques" ("amountCentimes", "bankName", "bounceReason", "createdAt", "depositedOn", "direction", "drawerName", "dueOn", "id", "issuedOn", "notes", "number", "schoolId", "settledOn", "status", "updatedAt") SELECT "amountCentimes", "bankName", "bounceReason", "createdAt", "depositedOn", "direction", "drawerName", "dueOn", "id", "issuedOn", "notes", "number", "schoolId", "settledOn", "status", "updatedAt" FROM "cheques";
DROP TABLE "cheques";
ALTER TABLE "new_cheques" RENAME TO "cheques";
CREATE INDEX "cheques_schoolId_idx" ON "cheques"("schoolId");
CREATE INDEX "cheques_bankId_idx" ON "cheques"("bankId");
CREATE INDEX "cheques_schoolId_status_idx" ON "cheques"("schoolId", "status");
CREATE INDEX "cheques_schoolId_number_idx" ON "cheques"("schoolId", "number");
CREATE INDEX "cheques_dueOn_idx" ON "cheques"("dueOn");
CREATE TABLE "new_payment_tenders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountCentimes" INTEGER NOT NULL,
    "reference" TEXT,
    "bankId" TEXT,
    "bankName" TEXT,
    "chequeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_tenders_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_tenders_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payment_tenders_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "cheques" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_payment_tenders" ("amountCentimes", "bankName", "chequeId", "createdAt", "id", "method", "paymentId", "reference", "updatedAt") SELECT "amountCentimes", "bankName", "chequeId", "createdAt", "id", "method", "paymentId", "reference", "updatedAt" FROM "payment_tenders";
DROP TABLE "payment_tenders";
ALTER TABLE "new_payment_tenders" RENAME TO "payment_tenders";
CREATE UNIQUE INDEX "payment_tenders_chequeId_key" ON "payment_tenders"("chequeId");
CREATE INDEX "payment_tenders_paymentId_idx" ON "payment_tenders"("paymentId");
CREATE INDEX "payment_tenders_bankId_idx" ON "payment_tenders"("bankId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "banks_schoolId_idx" ON "banks"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "banks_schoolId_code_key" ON "banks"("schoolId", "code");

-- CreateIndex
CREATE INDEX "operation_categories_schoolId_idx" ON "operation_categories"("schoolId");

-- CreateIndex
CREATE INDEX "operation_categories_schoolId_kind_idx" ON "operation_categories"("schoolId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "operation_categories_schoolId_code_key" ON "operation_categories"("schoolId", "code");

-- CreateIndex
CREATE INDEX "operation_motifs_schoolId_idx" ON "operation_motifs"("schoolId");

-- CreateIndex
CREATE INDEX "operation_motifs_categoryId_idx" ON "operation_motifs"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "operation_motifs_schoolId_code_key" ON "operation_motifs"("schoolId", "code");

-- CreateIndex
CREATE INDEX "operation_subcategories_categoryId_idx" ON "operation_subcategories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "operation_subcategories_categoryId_code_key" ON "operation_subcategories"("categoryId", "code");

