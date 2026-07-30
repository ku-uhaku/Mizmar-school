/*
  Warnings:

  - Added the required column `bookingKey` to the `timetable_entries` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_timetable_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolClassId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "timeSlotId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "roomId" TEXT,
    "termId" TEXT,
    "bookingKey" TEXT NOT NULL,
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
INSERT INTO "new_timetable_entries" ("classGroupId", "createdAt", "id", "roomId", "schoolClassId", "subjectId", "teacherId", "termId", "timeSlotId", "updatedAt") SELECT "classGroupId", "createdAt", "id", "roomId", "schoolClassId", "subjectId", "teacherId", "termId", "timeSlotId", "updatedAt" FROM "timetable_entries";
DROP TABLE "timetable_entries";
ALTER TABLE "new_timetable_entries" RENAME TO "timetable_entries";
CREATE INDEX "timetable_entries_schoolClassId_idx" ON "timetable_entries"("schoolClassId");
CREATE INDEX "timetable_entries_classGroupId_idx" ON "timetable_entries"("classGroupId");
CREATE INDEX "timetable_entries_timeSlotId_idx" ON "timetable_entries"("timeSlotId");
CREATE INDEX "timetable_entries_subjectId_idx" ON "timetable_entries"("subjectId");
CREATE INDEX "timetable_entries_teacherId_idx" ON "timetable_entries"("teacherId");
CREATE INDEX "timetable_entries_roomId_idx" ON "timetable_entries"("roomId");
CREATE INDEX "timetable_entries_termId_idx" ON "timetable_entries"("termId");
CREATE UNIQUE INDEX "timetable_entries_schoolClassId_timeSlotId_bookingKey_key" ON "timetable_entries"("schoolClassId", "timeSlotId", "bookingKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
