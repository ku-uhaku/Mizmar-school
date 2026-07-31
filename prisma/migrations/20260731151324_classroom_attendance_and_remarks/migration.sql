-- CreateTable
CREATE TABLE "student_attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "timeSlotId" TEXT,
    "subjectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "minutesLate" INTEGER,
    "reason" TEXT,
    "isJustified" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scopeKey" TEXT NOT NULL,
    CONSTRAINT "student_attendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_attendance_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "student_attendance_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "student_attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "student_remarks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "subjectId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "tone" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "body" TEXT NOT NULL,
    "occurredOn" DATETIME NOT NULL,
    "isVisibleToFamily" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "student_remarks_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_remarks_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "student_remarks_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assessment_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "defaultCoefficient" INTEGER NOT NULL DEFAULT 1,
    "defaultMaxScore" INTEGER NOT NULL DEFAULT 20,
    "countsTowardAverage" BOOLEAN NOT NULL DEFAULT true,
    "allowTeacherCreate" BOOLEAN NOT NULL DEFAULT false,
    "colorHex" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assessment_types_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_assessment_types" ("code", "colorHex", "countsTowardAverage", "createdAt", "defaultCoefficient", "defaultMaxScore", "id", "isActive", "name", "nameAr", "position", "schoolId", "updatedAt") SELECT "code", "colorHex", "countsTowardAverage", "createdAt", "defaultCoefficient", "defaultMaxScore", "id", "isActive", "name", "nameAr", "position", "schoolId", "updatedAt" FROM "assessment_types";
DROP TABLE "assessment_types";
ALTER TABLE "new_assessment_types" RENAME TO "assessment_types";
CREATE INDEX "assessment_types_schoolId_idx" ON "assessment_types"("schoolId");
CREATE UNIQUE INDEX "assessment_types_schoolId_code_key" ON "assessment_types"("schoolId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "student_attendance_enrollmentId_idx" ON "student_attendance"("enrollmentId");

-- CreateIndex
CREATE INDEX "student_attendance_timeSlotId_idx" ON "student_attendance"("timeSlotId");

-- CreateIndex
CREATE INDEX "student_attendance_subjectId_idx" ON "student_attendance"("subjectId");

-- CreateIndex
CREATE INDEX "student_attendance_recordedById_idx" ON "student_attendance"("recordedById");

-- CreateIndex
CREATE INDEX "student_attendance_date_idx" ON "student_attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_enrollmentId_date_scopeKey_key" ON "student_attendance"("enrollmentId", "date", "scopeKey");

-- CreateIndex
CREATE INDEX "student_remarks_enrollmentId_idx" ON "student_remarks"("enrollmentId");

-- CreateIndex
CREATE INDEX "student_remarks_subjectId_idx" ON "student_remarks"("subjectId");

-- CreateIndex
CREATE INDEX "student_remarks_authorId_idx" ON "student_remarks"("authorId");

-- CreateIndex
CREATE INDEX "student_remarks_occurredOn_idx" ON "student_remarks"("occurredOn");

