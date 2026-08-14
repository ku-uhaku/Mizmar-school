-- CreateTable
CREATE TABLE "teacher_subject_levels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherSubjectId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teacher_subject_levels_teacherSubjectId_fkey" FOREIGN KEY ("teacherSubjectId") REFERENCES "teacher_subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_subject_levels_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_teacher_subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "educationLevelId" TEXT,
    "preferenceRank" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "teacher_subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_subjects_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_subjects_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "education_levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Backfill: every existing qualification was declared against the school with no
-- year in mind, so it lands on the year the school is actually working in —
-- its default, failing that the active one, failing that the most recent. A
-- qualification for a school that has no year at all is dropped rather than
-- invented: there is nothing true to say about it, and the September screen
-- will ask for it again.
INSERT INTO "new_teacher_subjects" ("createdAt", "id", "isActive", "notes", "preferenceRank", "schoolId", "schoolYearId", "subjectId", "teacherId", "updatedAt")
SELECT
    ts."createdAt",
    ts."id",
    ts."isActive",
    ts."notes",
    ts."preferenceRank",
    ts."schoolId",
    (
        SELECT sy."id" FROM "school_years" sy
        WHERE sy."schoolId" = ts."schoolId"
        ORDER BY sy."isDefault" DESC, (sy."status" = 'ACTIVE') DESC, sy."startDate" DESC
        LIMIT 1
    ),
    ts."subjectId",
    ts."teacherId",
    ts."updatedAt"
FROM "teacher_subjects" ts
WHERE EXISTS (SELECT 1 FROM "school_years" sy WHERE sy."schoolId" = ts."schoolId");
DROP TABLE "teacher_subjects";
ALTER TABLE "new_teacher_subjects" RENAME TO "teacher_subjects";
CREATE INDEX "teacher_subjects_schoolId_idx" ON "teacher_subjects"("schoolId");
CREATE INDEX "teacher_subjects_schoolYearId_idx" ON "teacher_subjects"("schoolYearId");
CREATE INDEX "teacher_subjects_teacherId_idx" ON "teacher_subjects"("teacherId");
CREATE INDEX "teacher_subjects_subjectId_idx" ON "teacher_subjects"("subjectId");
CREATE INDEX "teacher_subjects_educationLevelId_idx" ON "teacher_subjects"("educationLevelId");
CREATE INDEX "teacher_subjects_schoolYearId_subjectId_idx" ON "teacher_subjects"("schoolYearId", "subjectId");
CREATE UNIQUE INDEX "teacher_subjects_schoolYearId_teacherId_subjectId_key" ON "teacher_subjects"("schoolYearId", "teacherId", "subjectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "teacher_subject_levels_teacherSubjectId_idx" ON "teacher_subject_levels"("teacherSubjectId");

-- CreateIndex
CREATE INDEX "teacher_subject_levels_levelId_idx" ON "teacher_subject_levels"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subject_levels_teacherSubjectId_levelId_key" ON "teacher_subject_levels"("teacherSubjectId", "levelId");

