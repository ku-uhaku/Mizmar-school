-- CreateTable
CREATE TABLE "school_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "gradingMaxScore" INTEGER NOT NULL DEFAULT 20,
    "passMarkBps" INTEGER NOT NULL DEFAULT 5000,
    "teachingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "currencyCode" TEXT NOT NULL DEFAULT 'MAD',
    "defaultLocale" TEXT NOT NULL DEFAULT 'fr',
    "defaultAccent" TEXT NOT NULL DEFAULT 'blue',
    "studentCodeFormat" TEXT NOT NULL DEFAULT 'E-{year}-{seq:4}',
    "familyCodeFormat" TEXT NOT NULL DEFAULT 'F-{year}-{seq:4}',
    "staffCodeFormat" TEXT NOT NULL DEFAULT 'P-{year}-{seq:4}',
    "defaultInstalmentCount" INTEGER NOT NULL DEFAULT 9,
    "feeDueDayOfMonth" INTEGER NOT NULL DEFAULT 5,
    "payrollWorkingDays" INTEGER NOT NULL DEFAULT 26,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "school_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "school_settings_schoolId_key" ON "school_settings"("schoolId");

