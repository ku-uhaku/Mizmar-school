-- CreateTable
CREATE TABLE "education_levels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "education_levels_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "level_subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "levelId" TEXT NOT NULL,
    "trackId" TEXT,
    "subjectId" TEXT NOT NULL,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "weeklyMinutes" INTEGER,
    "isGraded" BOOLEAN NOT NULL DEFAULT true,
    "isEliminatory" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "level_subjects_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_subjects_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "educationLevelId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "gradeYear" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "levels_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "education_levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "levels_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "shortName" TEXT,
    "colorHex" TEXT,
    "isLanguage" BOOLEAN NOT NULL DEFAULT false,
    "requiresLab" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "levelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tracks_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolClassId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'OTHER',
    "subjectId" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "class_groups_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "class_groups_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "level_offerings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "trackId" TEXT,
    "plannedCapacity" INTEGER,
    "tuitionCentimes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "level_offerings_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "level_offerings_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "level_offerings_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "levelOfferingId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "section" TEXT,
    "capacity" INTEGER,
    "mainTeacherId" TEXT,
    "roomId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "classes_levelOfferingId_fkey" FOREIGN KEY ("levelOfferingId") REFERENCES "level_offerings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "classes_mainTeacherId_fkey" FOREIGN KEY ("mainTeacherId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "classes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "teaching_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolClassId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weeklyMinutes" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "teaching_assignments_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teaching_assignments_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "teaching_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "teaching_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'CLASSROOM',
    "building" TEXT,
    "floor" INTEGER,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "rooms_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "terms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "terms_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "session" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "scheduleKind" TEXT NOT NULL DEFAULT 'STANDARD',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "time_slots_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "timetable_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolClassId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "timeSlotId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "roomId" TEXT,
    "termId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "timetable_entries_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timetable_entries_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timetable_entries_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timetable_entries_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "timetable_entries_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "timetable_entries_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "timetable_entries_termId_fkey" FOREIGN KEY ("termId") REFERENCES "terms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "education_levels_schoolId_idx" ON "education_levels"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "education_levels_schoolId_cycle_key" ON "education_levels"("schoolId", "cycle");

-- CreateIndex
CREATE INDEX "level_subjects_levelId_idx" ON "level_subjects"("levelId");

-- CreateIndex
CREATE INDEX "level_subjects_trackId_idx" ON "level_subjects"("trackId");

-- CreateIndex
CREATE INDEX "level_subjects_subjectId_idx" ON "level_subjects"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "level_subjects_levelId_trackId_subjectId_key" ON "level_subjects"("levelId", "trackId", "subjectId");

-- CreateIndex
CREATE INDEX "levels_educationLevelId_idx" ON "levels"("educationLevelId");

-- CreateIndex
CREATE INDEX "levels_schoolId_idx" ON "levels"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "levels_schoolId_code_key" ON "levels"("schoolId", "code");

-- CreateIndex
CREATE INDEX "subjects_schoolId_idx" ON "subjects"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_schoolId_code_key" ON "subjects"("schoolId", "code");

-- CreateIndex
CREATE INDEX "tracks_levelId_idx" ON "tracks"("levelId");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_levelId_code_key" ON "tracks"("levelId", "code");

-- CreateIndex
CREATE INDEX "class_groups_schoolClassId_idx" ON "class_groups"("schoolClassId");

-- CreateIndex
CREATE INDEX "class_groups_subjectId_idx" ON "class_groups"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "class_groups_schoolClassId_code_key" ON "class_groups"("schoolClassId", "code");

-- CreateIndex
CREATE INDEX "level_offerings_schoolYearId_idx" ON "level_offerings"("schoolYearId");

-- CreateIndex
CREATE INDEX "level_offerings_levelId_idx" ON "level_offerings"("levelId");

-- CreateIndex
CREATE INDEX "level_offerings_trackId_idx" ON "level_offerings"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "level_offerings_schoolYearId_levelId_trackId_key" ON "level_offerings"("schoolYearId", "levelId", "trackId");

-- CreateIndex
CREATE INDEX "classes_schoolId_idx" ON "classes"("schoolId");

-- CreateIndex
CREATE INDEX "classes_levelOfferingId_idx" ON "classes"("levelOfferingId");

-- CreateIndex
CREATE INDEX "classes_mainTeacherId_idx" ON "classes"("mainTeacherId");

-- CreateIndex
CREATE INDEX "classes_roomId_idx" ON "classes"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "classes_levelOfferingId_code_key" ON "classes"("levelOfferingId", "code");

-- CreateIndex
CREATE INDEX "teaching_assignments_schoolClassId_idx" ON "teaching_assignments"("schoolClassId");

-- CreateIndex
CREATE INDEX "teaching_assignments_classGroupId_idx" ON "teaching_assignments"("classGroupId");

-- CreateIndex
CREATE INDEX "teaching_assignments_subjectId_idx" ON "teaching_assignments"("subjectId");

-- CreateIndex
CREATE INDEX "teaching_assignments_teacherId_idx" ON "teaching_assignments"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_assignments_schoolClassId_classGroupId_subjectId_teacherId_key" ON "teaching_assignments"("schoolClassId", "classGroupId", "subjectId", "teacherId");

-- CreateIndex
CREATE INDEX "rooms_schoolId_idx" ON "rooms"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_schoolId_code_key" ON "rooms"("schoolId", "code");

-- CreateIndex
CREATE INDEX "terms_schoolYearId_idx" ON "terms"("schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "terms_schoolYearId_number_key" ON "terms"("schoolYearId", "number");

-- CreateIndex
CREATE INDEX "time_slots_schoolYearId_idx" ON "time_slots"("schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_schoolYearId_scheduleKind_dayOfWeek_startTime_key" ON "time_slots"("schoolYearId", "scheduleKind", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "timetable_entries_schoolClassId_idx" ON "timetable_entries"("schoolClassId");

-- CreateIndex
CREATE INDEX "timetable_entries_classGroupId_idx" ON "timetable_entries"("classGroupId");

-- CreateIndex
CREATE INDEX "timetable_entries_timeSlotId_idx" ON "timetable_entries"("timeSlotId");

-- CreateIndex
CREATE INDEX "timetable_entries_subjectId_idx" ON "timetable_entries"("subjectId");

-- CreateIndex
CREATE INDEX "timetable_entries_teacherId_idx" ON "timetable_entries"("teacherId");

-- CreateIndex
CREATE INDEX "timetable_entries_roomId_idx" ON "timetable_entries"("roomId");

-- CreateIndex
CREATE INDEX "timetable_entries_termId_idx" ON "timetable_entries"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_entries_schoolClassId_classGroupId_timeSlotId_termId_key" ON "timetable_entries"("schoolClassId", "classGroupId", "timeSlotId", "termId");
