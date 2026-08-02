-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'VENDOR',
    "defaultCategoryId" TEXT,
    "defaultSubcategoryId" TEXT,
    "accountRef" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "suppliers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "suppliers_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "operation_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "suppliers_defaultSubcategoryId_fkey" FOREIGN KEY ("defaultSubcategoryId") REFERENCES "operation_subcategories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "motifId" TEXT,
    "beneficiaryStaffId" TEXT,
    "beneficiaryName" TEXT,
    "supplierId" TEXT,
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
    CONSTRAINT "cash_operations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "operation_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "operation_subcategories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_motifId_fkey" FOREIGN KEY ("motifId") REFERENCES "operation_motifs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_beneficiaryStaffId_fkey" FOREIGN KEY ("beneficiaryStaffId") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_counterpartRegisterId_fkey" FOREIGN KEY ("counterpartRegisterId") REFERENCES "cash_registers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "cheques" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cash_operations" ("amountCentimes", "bankAccountLabel", "bankId", "beneficiaryName", "beneficiaryStaffId", "cashImpactCentimes", "cashSessionId", "categoryId", "chequeId", "counterpartRegisterId", "createdAt", "createdById", "id", "kind", "label", "method", "motifId", "occurredAt", "paymentId", "reference", "reversesOperationId", "schoolId", "status", "subcategoryId", "transferGroupId", "updatedAt") SELECT "amountCentimes", "bankAccountLabel", "bankId", "beneficiaryName", "beneficiaryStaffId", "cashImpactCentimes", "cashSessionId", "categoryId", "chequeId", "counterpartRegisterId", "createdAt", "createdById", "id", "kind", "label", "method", "motifId", "occurredAt", "paymentId", "reference", "reversesOperationId", "schoolId", "status", "subcategoryId", "transferGroupId", "updatedAt" FROM "cash_operations";
DROP TABLE "cash_operations";
ALTER TABLE "new_cash_operations" RENAME TO "cash_operations";
CREATE UNIQUE INDEX "cash_operations_reversesOperationId_key" ON "cash_operations"("reversesOperationId");
CREATE UNIQUE INDEX "cash_operations_paymentId_key" ON "cash_operations"("paymentId");
CREATE INDEX "cash_operations_schoolId_idx" ON "cash_operations"("schoolId");
CREATE INDEX "cash_operations_beneficiaryStaffId_idx" ON "cash_operations"("beneficiaryStaffId");
CREATE INDEX "cash_operations_supplierId_idx" ON "cash_operations"("supplierId");
CREATE INDEX "cash_operations_cashSessionId_idx" ON "cash_operations"("cashSessionId");
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "suppliers_schoolId_idx" ON "suppliers"("schoolId");

-- CreateIndex
CREATE INDEX "suppliers_schoolId_kind_isActive_idx" ON "suppliers"("schoolId", "kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_schoolId_code_key" ON "suppliers"("schoolId", "code");

