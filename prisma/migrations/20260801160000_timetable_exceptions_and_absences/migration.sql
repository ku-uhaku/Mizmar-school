-- CreateTable
CREATE TABLE "teacher_absences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "substituteId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "teacher_absences_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_absences_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teacher_absences_substituteId_fkey" FOREIGN KEY ("substituteId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "timetable_exceptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolClassId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "timeSlotId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT,
    "teacherId" TEXT,
    "roomId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scopeKey" TEXT NOT NULL,
    CONSTRAINT "timetable_exceptions_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timetable_exceptions_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timetable_exceptions_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timetable_exceptions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timetable_exceptions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "timetable_exceptions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "timetable_exceptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "teacher_absences_schoolId_idx" ON "teacher_absences"("schoolId");

-- CreateIndex
CREATE INDEX "teacher_absences_teacherId_idx" ON "teacher_absences"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_absences_schoolId_startDate_idx" ON "teacher_absences"("schoolId", "startDate");

-- CreateIndex
CREATE INDEX "timetable_exceptions_schoolClassId_idx" ON "timetable_exceptions"("schoolClassId");

-- CreateIndex
CREATE INDEX "timetable_exceptions_classGroupId_idx" ON "timetable_exceptions"("classGroupId");

-- CreateIndex
CREATE INDEX "timetable_exceptions_timeSlotId_idx" ON "timetable_exceptions"("timeSlotId");

-- CreateIndex
CREATE INDEX "timetable_exceptions_teacherId_idx" ON "timetable_exceptions"("teacherId");

-- CreateIndex
CREATE INDEX "timetable_exceptions_roomId_idx" ON "timetable_exceptions"("roomId");

-- CreateIndex
CREATE INDEX "timetable_exceptions_subjectId_idx" ON "timetable_exceptions"("subjectId");

-- CreateIndex
CREATE INDEX "timetable_exceptions_schoolClassId_weekStart_idx" ON "timetable_exceptions"("schoolClassId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_exceptions_schoolClassId_timeSlotId_weekStart_scopeKey_key" ON "timetable_exceptions"("schoolClassId", "timeSlotId", "weekStart", "scopeKey");

