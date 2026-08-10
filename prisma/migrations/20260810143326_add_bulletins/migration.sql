-- CreateTable
CREATE TABLE "bulletin_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bulletinId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "parentSubjectId" TEXT,
    "subjectName" TEXT NOT NULL,
    "teacherName" TEXT,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "average" REAL,
    "markCount" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "classAverage" REAL,
    "classLowest" REAL,
    "classHighest" REAL,
    "appreciation" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bulletin_lines_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "bulletins" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bulletin_lines_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bulletin_lines_parentSubjectId_fkey" FOREIGN KEY ("parentSubjectId") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bulletins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "schoolClassId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generalAverage" REAL,
    "outOf" INTEGER NOT NULL DEFAULT 20,
    "rank" INTEGER,
    "classSize" INTEGER NOT NULL DEFAULT 0,
    "classAverage" REAL,
    "classLowest" REAL,
    "classHighest" REAL,
    "absenceCount" INTEGER NOT NULL DEFAULT 0,
    "unjustifiedAbsenceCount" INTEGER NOT NULL DEFAULT 0,
    "lateCount" INTEGER NOT NULL DEFAULT 0,
    "mention" TEXT,
    "decision" TEXT,
    "councilComment" TEXT,
    "mainTeacherComment" TEXT,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "publishedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bulletins_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bulletins_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bulletins_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bulletins_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bulletins_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "bulletin_lines_bulletinId_idx" ON "bulletin_lines"("bulletinId");

-- CreateIndex
CREATE INDEX "bulletin_lines_subjectId_idx" ON "bulletin_lines"("subjectId");

-- CreateIndex
CREATE INDEX "bulletin_lines_parentSubjectId_idx" ON "bulletin_lines"("parentSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "bulletin_lines_bulletinId_subjectId_key" ON "bulletin_lines"("bulletinId", "subjectId");

-- CreateIndex
CREATE INDEX "bulletins_schoolId_idx" ON "bulletins"("schoolId");

-- CreateIndex
CREATE INDEX "bulletins_termId_idx" ON "bulletins"("termId");

-- CreateIndex
CREATE INDEX "bulletins_schoolClassId_idx" ON "bulletins"("schoolClassId");

-- CreateIndex
CREATE INDEX "bulletins_schoolClassId_termId_idx" ON "bulletins"("schoolClassId", "termId");

-- CreateIndex
CREATE INDEX "bulletins_enrollmentId_idx" ON "bulletins"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "bulletins_enrollmentId_termId_key" ON "bulletins"("enrollmentId", "termId");

