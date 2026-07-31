-- CreateTable
CREATE TABLE "cash_operations" (
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
    "beneficiaryName" TEXT,
    "transferGroupId" TEXT,
    "counterpartRegisterId" TEXT,
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
    CONSTRAINT "cash_operations_counterpartRegisterId_fkey" FOREIGN KEY ("counterpartRegisterId") REFERENCES "cash_registers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "cheques" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cash_registers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cash_sessions" (
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
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "openKey" TEXT,
    CONSTRAINT "cash_sessions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cheques" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'INCOMING',
    "number" TEXT NOT NULL,
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
    CONSTRAINT "cheques_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "expense_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "enrollmentFeeId" TEXT NOT NULL,
    "amountCentimes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_allocations_enrollmentFeeId_fkey" FOREIGN KEY ("enrollmentFeeId") REFERENCES "enrollment_fees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_tenders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountCentimes" INTEGER NOT NULL,
    "reference" TEXT,
    "bankName" TEXT,
    "chequeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_tenders_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_tenders_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "cheques" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
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
    "cashSessionId" TEXT,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_operations_reversesOperationId_key" ON "cash_operations"("reversesOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_operations_paymentId_key" ON "cash_operations"("paymentId");

-- CreateIndex
CREATE INDEX "cash_operations_schoolId_idx" ON "cash_operations"("schoolId");

-- CreateIndex
CREATE INDEX "cash_operations_cashSessionId_idx" ON "cash_operations"("cashSessionId");

-- CreateIndex
CREATE INDEX "cash_operations_expenseCategoryId_idx" ON "cash_operations"("expenseCategoryId");

-- CreateIndex
CREATE INDEX "cash_operations_counterpartRegisterId_idx" ON "cash_operations"("counterpartRegisterId");

-- CreateIndex
CREATE INDEX "cash_operations_chequeId_idx" ON "cash_operations"("chequeId");

-- CreateIndex
CREATE INDEX "cash_operations_createdById_idx" ON "cash_operations"("createdById");

-- CreateIndex
CREATE INDEX "cash_operations_transferGroupId_idx" ON "cash_operations"("transferGroupId");

-- CreateIndex
CREATE INDEX "cash_operations_schoolId_occurredAt_idx" ON "cash_operations"("schoolId", "occurredAt");

-- CreateIndex
CREATE INDEX "cash_operations_schoolId_kind_status_idx" ON "cash_operations"("schoolId", "kind", "status");

-- CreateIndex
CREATE INDEX "cash_registers_schoolId_idx" ON "cash_registers"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_schoolId_code_key" ON "cash_registers"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cash_sessions_openKey_key" ON "cash_sessions"("openKey");

-- CreateIndex
CREATE INDEX "cash_sessions_cashRegisterId_idx" ON "cash_sessions"("cashRegisterId");

-- CreateIndex
CREATE INDEX "cash_sessions_status_idx" ON "cash_sessions"("status");

-- CreateIndex
CREATE INDEX "cash_sessions_openedAt_idx" ON "cash_sessions"("openedAt");

-- CreateIndex
CREATE INDEX "cheques_schoolId_idx" ON "cheques"("schoolId");

-- CreateIndex
CREATE INDEX "cheques_schoolId_status_idx" ON "cheques"("schoolId", "status");

-- CreateIndex
CREATE INDEX "cheques_schoolId_number_idx" ON "cheques"("schoolId", "number");

-- CreateIndex
CREATE INDEX "cheques_dueOn_idx" ON "cheques"("dueOn");

-- CreateIndex
CREATE INDEX "expense_categories_schoolId_idx" ON "expense_categories"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_schoolId_code_key" ON "expense_categories"("schoolId", "code");

-- CreateIndex
CREATE INDEX "payment_allocations_enrollmentFeeId_idx" ON "payment_allocations"("enrollmentFeeId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_paymentId_enrollmentFeeId_key" ON "payment_allocations"("paymentId", "enrollmentFeeId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_tenders_chequeId_key" ON "payment_tenders"("chequeId");

-- CreateIndex
CREATE INDEX "payment_tenders_paymentId_idx" ON "payment_tenders"("paymentId");

-- CreateIndex
CREATE INDEX "payments_schoolId_idx" ON "payments"("schoolId");

-- CreateIndex
CREATE INDEX "payments_schoolYearId_idx" ON "payments"("schoolYearId");

-- CreateIndex
CREATE INDEX "payments_familyId_idx" ON "payments"("familyId");

-- CreateIndex
CREATE INDEX "payments_cashSessionId_idx" ON "payments"("cashSessionId");

-- CreateIndex
CREATE INDEX "payments_schoolId_paidAt_idx" ON "payments"("schoolId", "paidAt");

-- CreateIndex
CREATE INDEX "payments_schoolId_status_idx" ON "payments"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_schoolId_code_key" ON "payments"("schoolId", "code");

