-- AlterTable
ALTER TABLE "staff" ADD COLUMN "maxWeeklyMinutes" INTEGER;

-- CreateTable
CREATE TABLE "teacher_subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "preferenceRank" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "teacher_subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "school_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_school_settings" ("createdAt", "currencyCode", "defaultAccent", "defaultInstalmentCount", "defaultLocale", "familyCodeFormat", "feeDueDayOfMonth", "gradingMaxScore", "id", "passMarkBps", "payrollWorkingDays", "schoolId", "staffCodeFormat", "studentCodeFormat", "teachingDays", "updatedAt") SELECT "createdAt", "currencyCode", "defaultAccent", "defaultInstalmentCount", "defaultLocale", "familyCodeFormat", "feeDueDayOfMonth", "gradingMaxScore", "id", "passMarkBps", "payrollWorkingDays", "schoolId", "staffCodeFormat", "studentCodeFormat", "teachingDays", "updatedAt" FROM "school_settings";
DROP TABLE "school_settings";
ALTER TABLE "new_school_settings" RENAME TO "school_settings";
CREATE UNIQUE INDEX "school_settings_schoolId_key" ON "school_settings"("schoolId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "teacher_subjects_schoolId_idx" ON "teacher_subjects"("schoolId");

-- CreateIndex
CREATE INDEX "teacher_subjects_teacherId_idx" ON "teacher_subjects"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_subjects_subjectId_idx" ON "teacher_subjects"("subjectId");

-- CreateIndex
CREATE INDEX "teacher_subjects_schoolId_subjectId_idx" ON "teacher_subjects"("schoolId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subjects_teacherId_subjectId_key" ON "teacher_subjects"("teacherId", "subjectId");

