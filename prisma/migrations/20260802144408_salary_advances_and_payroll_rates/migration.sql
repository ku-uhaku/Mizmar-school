-- CreateTable
CREATE TABLE "salary_advances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "amountCentimes" INTEGER NOT NULL,
    "instalmentCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "decisionNote" TEXT,
    "paidOn" DATETIME,
    "cashOperationId" TEXT,
    "recoverFromYear" INTEGER,
    "recoverFromMonth" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "salary_advances_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "salary_advances_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "salary_advances_cashOperationId_fkey" FOREIGN KEY ("cashOperationId") REFERENCES "cash_operations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "salary_advance_recoveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "advanceId" TEXT NOT NULL,
    "salaryPaymentId" TEXT NOT NULL,
    "amountCentimes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_advance_recoveries_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "salary_advances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "salary_advance_recoveries_salaryPaymentId_fkey" FOREIGN KEY ("salaryPaymentId") REFERENCES "salary_payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_school_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "gradingMaxScore" INTEGER NOT NULL DEFAULT 20,
    "passMarkBps" INTEGER NOT NULL DEFAULT 5000,
    "teachingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "teacherWeeklyMinutes" INTEGER NOT NULL DEFAULT 1320,
    "classWeeklyMinutes" INTEGER NOT NULL DEFAULT 1800,
    "currencyCode" TEXT NOT NULL DEFAULT 'MAD',
    "defaultLocale" TEXT NOT NULL DEFAULT 'fr',
    "defaultAccent" TEXT NOT NULL DEFAULT 'blue',
    "studentCodeFormat" TEXT NOT NULL DEFAULT 'E-{year}-{seq:4}',
    "familyCodeFormat" TEXT NOT NULL DEFAULT 'F-{year}-{seq:4}',
    "staffCodeFormat" TEXT NOT NULL DEFAULT 'P-{year}-{seq:4}',
    "defaultInstalmentCount" INTEGER NOT NULL DEFAULT 9,
    "feeDueDayOfMonth" INTEGER NOT NULL DEFAULT 5,
    "payrollWorkingDays" INTEGER NOT NULL DEFAULT 26,
    "cnssRateBps" INTEGER NOT NULL DEFAULT 448,
    "cnssCeilingCentimes" INTEGER NOT NULL DEFAULT 600000,
    "amoRateBps" INTEGER NOT NULL DEFAULT 226,
    "irRateBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "school_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_school_settings" ("classWeeklyMinutes", "createdAt", "currencyCode", "defaultAccent", "defaultInstalmentCount", "defaultLocale", "familyCodeFormat", "feeDueDayOfMonth", "gradingMaxScore", "id", "passMarkBps", "payrollWorkingDays", "schoolId", "staffCodeFormat", "studentCodeFormat", "teacherWeeklyMinutes", "teachingDays", "updatedAt") SELECT "classWeeklyMinutes", "createdAt", "currencyCode", "defaultAccent", "defaultInstalmentCount", "defaultLocale", "familyCodeFormat", "feeDueDayOfMonth", "gradingMaxScore", "id", "passMarkBps", "payrollWorkingDays", "schoolId", "staffCodeFormat", "studentCodeFormat", "teacherWeeklyMinutes", "teachingDays", "updatedAt" FROM "school_settings";
DROP TABLE "school_settings";
ALTER TABLE "new_school_settings" RENAME TO "school_settings";
CREATE UNIQUE INDEX "school_settings_schoolId_key" ON "school_settings"("schoolId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "salary_advances_cashOperationId_key" ON "salary_advances"("cashOperationId");

-- CreateIndex
CREATE INDEX "salary_advances_staffId_idx" ON "salary_advances"("staffId");

-- CreateIndex
CREATE INDEX "salary_advances_staffId_status_idx" ON "salary_advances"("staffId", "status");

-- CreateIndex
CREATE INDEX "salary_advances_status_idx" ON "salary_advances"("status");

-- CreateIndex
CREATE INDEX "salary_advance_recoveries_advanceId_idx" ON "salary_advance_recoveries"("advanceId");

-- CreateIndex
CREATE INDEX "salary_advance_recoveries_salaryPaymentId_idx" ON "salary_advance_recoveries"("salaryPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "salary_advance_recoveries_advanceId_salaryPaymentId_key" ON "salary_advance_recoveries"("advanceId", "salaryPaymentId");

