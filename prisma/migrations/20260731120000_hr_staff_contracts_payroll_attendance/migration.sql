-- CreateTable
CREATE TABLE "employment_contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CDI',
    "startsOn" DATETIME NOT NULL,
    "endsOn" DATETIME,
    "trialEndsOn" DATETIME,
    "baseSalaryCentimes" INTEGER NOT NULL,
    "weeklyHours" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "activeKey" TEXT,
    CONSTRAINT "employment_contracts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ANNUAL',
    "startsOn" DATETIME NOT NULL,
    "endsOn" DATETIME NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "leave_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leave_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "salary_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "contractId" TEXT,
    "baseCentimes" INTEGER NOT NULL DEFAULT 0,
    "allowanceCentimes" INTEGER NOT NULL DEFAULT 0,
    "overtimeCentimes" INTEGER NOT NULL DEFAULT 0,
    "bonusCentimes" INTEGER NOT NULL DEFAULT 0,
    "absenceCentimes" INTEGER NOT NULL DEFAULT 0,
    "advanceCentimes" INTEGER NOT NULL DEFAULT 0,
    "socialCentimes" INTEGER NOT NULL DEFAULT 0,
    "taxCentimes" INTEGER NOT NULL DEFAULT 0,
    "otherDeductionCentimes" INTEGER NOT NULL DEFAULT 0,
    "deductionLabel" TEXT,
    "netCentimes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paidOn" DATETIME,
    "cashOperationId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "salary_payments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "salary_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "employment_contracts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "salary_payments_cashOperationId_fkey" FOREIGN KEY ("cashOperationId") REFERENCES "cash_operations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "staff_attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "isJustified" BOOLEAN NOT NULL DEFAULT false,
    "minutesLate" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "staff_attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "code" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstNameAr" TEXT,
    "lastNameAr" TEXT,
    "gender" TEXT,
    "birthDate" DATETIME,
    "birthPlace" TEXT,
    "nationalId" TEXT,
    "cnssNumber" TEXT,
    "bankRib" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "photoUrl" TEXT,
    "jobRole" TEXT NOT NULL DEFAULT 'TEACHER',
    "jobTitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "hiredOn" DATETIME,
    "leftOn" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "beneficiaryStaffId" TEXT,
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
    CONSTRAINT "cash_operations_beneficiaryStaffId_fkey" FOREIGN KEY ("beneficiaryStaffId") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_counterpartRegisterId_fkey" FOREIGN KEY ("counterpartRegisterId") REFERENCES "cash_registers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "cheques" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "cash_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cash_operations" ("amountCentimes", "bankAccountLabel", "beneficiaryName", "cashImpactCentimes", "cashSessionId", "chequeId", "counterpartRegisterId", "createdAt", "createdById", "expenseCategoryId", "id", "kind", "label", "method", "occurredAt", "paymentId", "reference", "reversesOperationId", "schoolId", "status", "transferGroupId", "updatedAt") SELECT "amountCentimes", "bankAccountLabel", "beneficiaryName", "cashImpactCentimes", "cashSessionId", "chequeId", "counterpartRegisterId", "createdAt", "createdById", "expenseCategoryId", "id", "kind", "label", "method", "occurredAt", "paymentId", "reference", "reversesOperationId", "schoolId", "status", "transferGroupId", "updatedAt" FROM "cash_operations";
DROP TABLE "cash_operations";
ALTER TABLE "new_cash_operations" RENAME TO "cash_operations";
CREATE UNIQUE INDEX "cash_operations_reversesOperationId_key" ON "cash_operations"("reversesOperationId");
CREATE UNIQUE INDEX "cash_operations_paymentId_key" ON "cash_operations"("paymentId");
CREATE INDEX "cash_operations_schoolId_idx" ON "cash_operations"("schoolId");
CREATE INDEX "cash_operations_beneficiaryStaffId_idx" ON "cash_operations"("beneficiaryStaffId");
CREATE INDEX "cash_operations_cashSessionId_idx" ON "cash_operations"("cashSessionId");
CREATE INDEX "cash_operations_expenseCategoryId_idx" ON "cash_operations"("expenseCategoryId");
CREATE INDEX "cash_operations_counterpartRegisterId_idx" ON "cash_operations"("counterpartRegisterId");
CREATE INDEX "cash_operations_chequeId_idx" ON "cash_operations"("chequeId");
CREATE INDEX "cash_operations_createdById_idx" ON "cash_operations"("createdById");
CREATE INDEX "cash_operations_transferGroupId_idx" ON "cash_operations"("transferGroupId");
CREATE INDEX "cash_operations_schoolId_occurredAt_idx" ON "cash_operations"("schoolId", "occurredAt");
CREATE INDEX "cash_operations_schoolId_kind_status_idx" ON "cash_operations"("schoolId", "kind", "status");
CREATE TABLE "new_vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "modelYear" INTEGER,
    "seatCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "insuranceExpiresOn" DATETIME,
    "inspectionExpiresOn" DATETIME,
    "driverId" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicles_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_vehicles" ("createdAt", "driverName", "driverPhone", "id", "inspectionExpiresOn", "insuranceExpiresOn", "make", "model", "modelYear", "notes", "registration", "schoolId", "seatCount", "status", "updatedAt") SELECT "createdAt", "driverName", "driverPhone", "id", "inspectionExpiresOn", "insuranceExpiresOn", "make", "model", "modelYear", "notes", "registration", "schoolId", "seatCount", "status", "updatedAt" FROM "vehicles";
DROP TABLE "vehicles";
ALTER TABLE "new_vehicles" RENAME TO "vehicles";
CREATE INDEX "vehicles_schoolId_idx" ON "vehicles"("schoolId");
CREATE INDEX "vehicles_driverId_idx" ON "vehicles"("driverId");
CREATE INDEX "vehicles_schoolId_status_idx" ON "vehicles"("schoolId", "status");
CREATE UNIQUE INDEX "vehicles_schoolId_registration_key" ON "vehicles"("schoolId", "registration");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "employment_contracts_activeKey_key" ON "employment_contracts"("activeKey");

-- CreateIndex
CREATE INDEX "employment_contracts_staffId_idx" ON "employment_contracts"("staffId");

-- CreateIndex
CREATE INDEX "employment_contracts_staffId_startsOn_idx" ON "employment_contracts"("staffId", "startsOn");

-- CreateIndex
CREATE INDEX "leave_requests_staffId_idx" ON "leave_requests"("staffId");

-- CreateIndex
CREATE INDEX "leave_requests_staffId_startsOn_idx" ON "leave_requests"("staffId", "startsOn");

-- CreateIndex
CREATE INDEX "leave_requests_status_startsOn_idx" ON "leave_requests"("status", "startsOn");

-- CreateIndex
CREATE INDEX "leave_requests_decidedById_idx" ON "leave_requests"("decidedById");

-- CreateIndex
CREATE UNIQUE INDEX "salary_payments_cashOperationId_key" ON "salary_payments"("cashOperationId");

-- CreateIndex
CREATE INDEX "salary_payments_staffId_idx" ON "salary_payments"("staffId");

-- CreateIndex
CREATE INDEX "salary_payments_staffId_periodYear_periodMonth_idx" ON "salary_payments"("staffId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "salary_payments_periodYear_periodMonth_status_idx" ON "salary_payments"("periodYear", "periodMonth", "status");

-- CreateIndex
CREATE UNIQUE INDEX "salary_payments_staffId_periodYear_periodMonth_key" ON "salary_payments"("staffId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "staff_attendance_staffId_idx" ON "staff_attendance"("staffId");

-- CreateIndex
CREATE INDEX "staff_attendance_staffId_date_idx" ON "staff_attendance"("staffId", "date");

-- CreateIndex
CREATE INDEX "staff_attendance_date_status_idx" ON "staff_attendance"("date", "status");

-- CreateIndex
CREATE INDEX "staff_attendance_recordedById_idx" ON "staff_attendance"("recordedById");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_staffId_date_key" ON "staff_attendance"("staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE INDEX "staff_schoolId_idx" ON "staff"("schoolId");

-- CreateIndex
CREATE INDEX "staff_schoolId_lastName_idx" ON "staff"("schoolId", "lastName");

-- CreateIndex
CREATE INDEX "staff_schoolId_status_idx" ON "staff"("schoolId", "status");

-- CreateIndex
CREATE INDEX "staff_schoolId_jobRole_idx" ON "staff"("schoolId", "jobRole");

-- CreateIndex
CREATE UNIQUE INDEX "staff_schoolId_code_key" ON "staff"("schoolId", "code");

