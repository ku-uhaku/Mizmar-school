-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assessments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "scheduledOn" DATETIME,
    "maxScore" INTEGER NOT NULL DEFAULT 20,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "countsTowardAverage" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "teacherId" TEXT,
    "createdById" TEXT,
    "notes" TEXT,
    "massarCode" TEXT,
    "scopeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assessments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assessments_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assessments_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assessments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assessments_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assessments_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "assessment_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assessments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "assessments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_assessments" ("assessmentTypeId", "classGroupId", "coefficient", "createdAt", "createdById", "id", "massarCode", "maxScore", "notes", "scheduledOn", "schoolClassId", "schoolId", "scopeKey", "sequence", "status", "subjectId", "teacherId", "termId", "title", "updatedAt") SELECT "assessmentTypeId", "classGroupId", "coefficient", "createdAt", "createdById", "id", "massarCode", "maxScore", "notes", "scheduledOn", "schoolClassId", "schoolId", "scopeKey", "sequence", "status", "subjectId", "teacherId", "termId", "title", "updatedAt" FROM "assessments";
DROP TABLE "assessments";
ALTER TABLE "new_assessments" RENAME TO "assessments";
CREATE INDEX "assessments_schoolId_idx" ON "assessments"("schoolId");
CREATE INDEX "assessments_schoolClassId_idx" ON "assessments"("schoolClassId");
CREATE INDEX "assessments_classGroupId_idx" ON "assessments"("classGroupId");
CREATE INDEX "assessments_subjectId_idx" ON "assessments"("subjectId");
CREATE INDEX "assessments_termId_idx" ON "assessments"("termId");
CREATE INDEX "assessments_assessmentTypeId_idx" ON "assessments"("assessmentTypeId");
CREATE INDEX "assessments_teacherId_idx" ON "assessments"("teacherId");
CREATE INDEX "assessments_createdById_idx" ON "assessments"("createdById");
CREATE UNIQUE INDEX "assessments_schoolClassId_subjectId_termId_assessmentTypeId_sequence_scopeKey_key" ON "assessments"("schoolClassId", "subjectId", "termId", "assessmentTypeId", "sequence", "scopeKey");
CREATE UNIQUE INDEX "assessments_schoolId_massarCode_key" ON "assessments"("schoolId", "massarCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Backfill: every paper already sat keeps answering exactly as it did.
--
-- The column is new, so the rebuild above left every row on the `true` default —
-- which would have started counting the papers of a kind the school had marked
-- as not counting. Stamping each row with its own type's value is what makes
-- this migration change nothing today, and what stops re-configuring a kind
-- tomorrow from rescoring marks already entered under it.
UPDATE "assessments"
SET "countsTowardAverage" = COALESCE(
  (
    SELECT "t"."countsTowardAverage"
    FROM "assessment_types" AS "t"
    WHERE "t"."id" = "assessments"."assessmentTypeId"
  ),
  true
);
