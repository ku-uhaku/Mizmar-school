-- CreateTable
CREATE TABLE "assessment_grades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "score" REAL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "isExcused" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "gradedById" TEXT,
    "gradedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assessment_grades_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assessment_grades_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assessment_grades_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assessment_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "defaultCoefficient" INTEGER NOT NULL DEFAULT 1,
    "defaultMaxScore" INTEGER NOT NULL DEFAULT 20,
    "countsTowardAverage" BOOLEAN NOT NULL DEFAULT true,
    "colorHex" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "assessment_types_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assessments" (
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
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "teacherId" TEXT,
    "createdById" TEXT,
    "notes" TEXT,
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

-- CreateIndex
CREATE INDEX "assessment_grades_assessmentId_idx" ON "assessment_grades"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_grades_enrollmentId_idx" ON "assessment_grades"("enrollmentId");

-- CreateIndex
CREATE INDEX "assessment_grades_gradedById_idx" ON "assessment_grades"("gradedById");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_grades_assessmentId_enrollmentId_key" ON "assessment_grades"("assessmentId", "enrollmentId");

-- CreateIndex
CREATE INDEX "assessment_types_schoolId_idx" ON "assessment_types"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_types_schoolId_code_key" ON "assessment_types"("schoolId", "code");

-- CreateIndex
CREATE INDEX "assessments_schoolId_idx" ON "assessments"("schoolId");

-- CreateIndex
CREATE INDEX "assessments_schoolClassId_idx" ON "assessments"("schoolClassId");

-- CreateIndex
CREATE INDEX "assessments_classGroupId_idx" ON "assessments"("classGroupId");

-- CreateIndex
CREATE INDEX "assessments_subjectId_idx" ON "assessments"("subjectId");

-- CreateIndex
CREATE INDEX "assessments_termId_idx" ON "assessments"("termId");

-- CreateIndex
CREATE INDEX "assessments_assessmentTypeId_idx" ON "assessments"("assessmentTypeId");

-- CreateIndex
CREATE INDEX "assessments_teacherId_idx" ON "assessments"("teacherId");

-- CreateIndex
CREATE INDEX "assessments_createdById_idx" ON "assessments"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_schoolClassId_subjectId_termId_assessmentTypeId_sequence_scopeKey_key" ON "assessments"("schoolClassId", "subjectId", "termId", "assessmentTypeId", "sequence", "scopeKey");

