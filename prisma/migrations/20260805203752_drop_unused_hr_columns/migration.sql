-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_salary_advances" (
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
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "salary_advances_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "salary_advances_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "salary_advances_cashOperationId_fkey" FOREIGN KEY ("cashOperationId") REFERENCES "cash_operations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_salary_advances" ("amountCentimes", "approvedAt", "approvedById", "cashOperationId", "createdAt", "decisionNote", "id", "instalmentCount", "notes", "paidOn", "reason", "requestedOn", "staffId", "status", "updatedAt") SELECT "amountCentimes", "approvedAt", "approvedById", "cashOperationId", "createdAt", "decisionNote", "id", "instalmentCount", "notes", "paidOn", "reason", "requestedOn", "staffId", "status", "updatedAt" FROM "salary_advances";
DROP TABLE "salary_advances";
ALTER TABLE "new_salary_advances" RENAME TO "salary_advances";
CREATE UNIQUE INDEX "salary_advances_cashOperationId_key" ON "salary_advances"("cashOperationId");
CREATE INDEX "salary_advances_staffId_idx" ON "salary_advances"("staffId");
CREATE INDEX "salary_advances_staffId_status_idx" ON "salary_advances"("staffId", "status");
CREATE INDEX "salary_advances_status_idx" ON "salary_advances"("status");
CREATE TABLE "new_staff" (
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
    "jobRole" TEXT NOT NULL DEFAULT 'TEACHER',
    "jobTitle" TEXT,
    "maxWeeklyMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "hiredOn" DATETIME,
    "leftOn" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_staff" ("address", "bankRib", "birthDate", "birthPlace", "cnssNumber", "code", "createdAt", "email", "firstName", "firstNameAr", "gender", "hiredOn", "id", "jobRole", "jobTitle", "lastName", "lastNameAr", "leftOn", "maxWeeklyMinutes", "nationalId", "notes", "phone", "schoolId", "status", "updatedAt", "userId") SELECT "address", "bankRib", "birthDate", "birthPlace", "cnssNumber", "code", "createdAt", "email", "firstName", "firstNameAr", "gender", "hiredOn", "id", "jobRole", "jobTitle", "lastName", "lastNameAr", "leftOn", "maxWeeklyMinutes", "nationalId", "notes", "phone", "schoolId", "status", "updatedAt", "userId" FROM "staff";
DROP TABLE "staff";
ALTER TABLE "new_staff" RENAME TO "staff";
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");
CREATE INDEX "staff_schoolId_idx" ON "staff"("schoolId");
CREATE INDEX "staff_schoolId_lastName_idx" ON "staff"("schoolId", "lastName");
CREATE INDEX "staff_schoolId_status_idx" ON "staff"("schoolId", "status");
CREATE INDEX "staff_schoolId_jobRole_idx" ON "staff"("schoolId", "jobRole");
CREATE UNIQUE INDEX "staff_schoolId_code_key" ON "staff"("schoolId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

