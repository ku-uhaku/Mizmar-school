-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_school_settings" (
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
    "defaultInstalmentCount" INTEGER NOT NULL DEFAULT 0,
    "parentChatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "parentClassChatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "feeDueDayOfMonth" INTEGER NOT NULL DEFAULT 5,
    "periodMinutes" INTEGER NOT NULL DEFAULT 60,
    "dayStartsAt" TEXT NOT NULL DEFAULT '08:00',
    "afternoonStartsAt" TEXT NOT NULL DEFAULT '14:00',
    "periodsBeforeBreak" INTEGER NOT NULL DEFAULT 2,
    "breakMinutes" INTEGER NOT NULL DEFAULT 15,
    "morningPeriods" INTEGER NOT NULL DEFAULT 4,
    "afternoonPeriods" INTEGER NOT NULL DEFAULT 4,
    "payrollWorkingDays" INTEGER NOT NULL DEFAULT 26,
    "cnssRateBps" INTEGER NOT NULL DEFAULT 448,
    "cnssCeilingCentimes" INTEGER NOT NULL DEFAULT 600000,
    "amoRateBps" INTEGER NOT NULL DEFAULT 226,
    "irRateBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "school_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_school_settings" ("afternoonPeriods", "afternoonStartsAt", "amoRateBps", "breakMinutes", "cnssCeilingCentimes", "cnssRateBps", "createdAt", "currencyCode", "dayStartsAt", "defaultAccent", "defaultInstalmentCount", "defaultLocale", "familyCodeFormat", "feeDueDayOfMonth", "gradingMaxScore", "id", "irRateBps", "morningPeriods", "passMarkBps", "payrollWorkingDays", "periodMinutes", "periodsBeforeBreak", "schoolId", "staffCodeFormat", "studentCodeFormat", "teachingDays", "updatedAt") SELECT "afternoonPeriods", "afternoonStartsAt", "amoRateBps", "breakMinutes", "cnssCeilingCentimes", "cnssRateBps", "createdAt", "currencyCode", "dayStartsAt", "defaultAccent", "defaultInstalmentCount", "defaultLocale", "familyCodeFormat", "feeDueDayOfMonth", "gradingMaxScore", "id", "irRateBps", "morningPeriods", "passMarkBps", "payrollWorkingDays", "periodMinutes", "periodsBeforeBreak", "schoolId", "staffCodeFormat", "studentCodeFormat", "teachingDays", "updatedAt" FROM "school_settings";
DROP TABLE "school_settings";
ALTER TABLE "new_school_settings" RENAME TO "school_settings";
CREATE UNIQUE INDEX "school_settings_schoolId_key" ON "school_settings"("schoolId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

