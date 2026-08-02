-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN "canteenStartsOn" DATETIME;
ALTER TABLE "enrollments" ADD COLUMN "transportStartsOn" DATETIME;

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
    "birthCityId" TEXT,
    "neighbourhoodId" TEXT,
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
    "previousLevel" TEXT,
    "previousSchoolCityId" TEXT,
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
    CONSTRAINT "students_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "students_birthCityId_fkey" FOREIGN KEY ("birthCityId") REFERENCES "cities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "neighbourhoods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_previousSchoolCityId_fkey" FOREIGN KEY ("previousSchoolCityId") REFERENCES "cities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_students" ("allergies", "birthCityId", "birthDate", "birthRank", "bloodType", "brotherCount", "chronicCondition", "code", "createdAt", "doctorName", "doctorPhone", "entryDate", "exitDate", "familyId", "firstName", "firstNameAr", "gender", "hasDisability", "id", "insurer", "isActive", "isOrphan", "lastName", "lastNameAr", "livesWith", "massarCode", "medicalNotes", "medications", "nationalId", "nationality", "notes", "photoUrl", "previousLevel", "previousSchool", "previousSchoolCityId", "schoolId", "schoolingType", "sisterCount", "status", "transferReason", "updatedAt") SELECT "allergies", "birthCityId", "birthDate", "birthRank", "bloodType", "brotherCount", "chronicCondition", "code", "createdAt", "doctorName", "doctorPhone", "entryDate", "exitDate", "familyId", "firstName", "firstNameAr", "gender", "hasDisability", "id", "insurer", "isActive", "isOrphan", "lastName", "lastNameAr", "livesWith", "massarCode", "medicalNotes", "medications", "nationalId", "nationality", "notes", "photoUrl", "previousLevel", "previousSchool", "previousSchoolCityId", "schoolId", "schoolingType", "sisterCount", "status", "transferReason", "updatedAt" FROM "students";
DROP TABLE "students";
ALTER TABLE "new_students" RENAME TO "students";
CREATE INDEX "students_schoolId_idx" ON "students"("schoolId");
CREATE INDEX "students_familyId_idx" ON "students"("familyId");
CREATE INDEX "students_neighbourhoodId_idx" ON "students"("neighbourhoodId");
CREATE INDEX "students_birthCityId_idx" ON "students"("birthCityId");
CREATE INDEX "students_previousSchoolCityId_idx" ON "students"("previousSchoolCityId");
CREATE INDEX "students_schoolId_lastName_idx" ON "students"("schoolId", "lastName");
CREATE INDEX "students_schoolId_status_idx" ON "students"("schoolId", "status");
CREATE UNIQUE INDEX "students_schoolId_code_key" ON "students"("schoolId", "code");
CREATE UNIQUE INDEX "students_schoolId_massarCode_key" ON "students"("schoolId", "massarCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

