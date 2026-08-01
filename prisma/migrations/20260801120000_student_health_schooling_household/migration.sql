-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "familyId" TEXT,
    "code" TEXT NOT NULL,
    "massarCode" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstNameAr" TEXT,
    "lastNameAr" TEXT,
    "gender" TEXT NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "birthPlace" TEXT,
    "birthPlaceAr" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'MA',
    "nationalId" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRE_REGISTERED',
    "entryDate" DATETIME,
    "exitDate" DATETIME,
    "bloodType" TEXT,
    "allergies" TEXT,
    "chronicCondition" TEXT,
    "medications" TEXT,
    "doctorName" TEXT,
    "doctorPhone" TEXT,
    "insurer" TEXT,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false,
    "medicalNotes" TEXT,
    "previousSchool" TEXT,
    "previousSchoolCity" TEXT,
    "previousLevel" TEXT,
    "schoolingType" TEXT,
    "transferReason" TEXT,
    "brotherCount" INTEGER,
    "sisterCount" INTEGER,
    "birthRank" INTEGER,
    "livesWith" TEXT,
    "isOrphan" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "students_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_students" ("birthDate", "birthPlace", "birthPlaceAr", "code", "createdAt", "entryDate", "exitDate", "familyId", "firstName", "firstNameAr", "gender", "id", "isActive", "lastName", "lastNameAr", "massarCode", "medicalNotes", "nationalId", "nationality", "notes", "photoUrl", "schoolId", "status", "updatedAt") SELECT "birthDate", "birthPlace", "birthPlaceAr", "code", "createdAt", "entryDate", "exitDate", "familyId", "firstName", "firstNameAr", "gender", "id", "isActive", "lastName", "lastNameAr", "massarCode", "medicalNotes", "nationalId", "nationality", "notes", "photoUrl", "schoolId", "status", "updatedAt" FROM "students";
DROP TABLE "students";
ALTER TABLE "new_students" RENAME TO "students";
CREATE INDEX "students_schoolId_idx" ON "students"("schoolId");
CREATE INDEX "students_familyId_idx" ON "students"("familyId");
CREATE INDEX "students_schoolId_lastName_idx" ON "students"("schoolId", "lastName");
CREATE INDEX "students_schoolId_status_idx" ON "students"("schoolId", "status");
CREATE UNIQUE INDEX "students_schoolId_code_key" ON "students"("schoolId", "code");
CREATE UNIQUE INDEX "students_schoolId_massarCode_key" ON "students"("schoolId", "massarCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

