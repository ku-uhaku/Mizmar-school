-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cities_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "cities_schoolId_idx" ON "cities"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "cities_schoolId_code_key" ON "cities"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cities_schoolId_name_key" ON "cities"("schoolId", "name");

-- Backfill: every town already typed into a pupil's file becomes a row, so the
-- list starts out holding what the school actually uses and no birthplace is
-- lost when the text columns go. Ids are deterministic (`city-<school>-<name>`)
-- rather than cuid so the UPDATE below can join on them without a temp table;
-- nothing outside this migration depends on their shape. The code is the name
-- upper-cased — the school renames it under /configuration, and `seedCities`
-- rewrites the ones it knows.
INSERT INTO "cities" ("id", "schoolId", "code", "name", "nameAr", "region", "isActive", "createdAt", "updatedAt")
SELECT
    'city-' || s."schoolId" || '-' || UPPER(REPLACE(TRIM(s."birthPlace"), ' ', '-')),
    s."schoolId",
    UPPER(REPLACE(TRIM(s."birthPlace"), ' ', '-')),
    TRIM(s."birthPlace"),
    MAX(TRIM(s."birthPlaceAr")),
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "students" s
WHERE s."birthPlace" IS NOT NULL AND TRIM(s."birthPlace") <> ''
GROUP BY s."schoolId", TRIM(s."birthPlace");

INSERT INTO "cities" ("id", "schoolId", "code", "name", "nameAr", "region", "isActive", "createdAt", "updatedAt")
SELECT
    'city-' || s."schoolId" || '-' || UPPER(REPLACE(TRIM(s."previousSchoolCity"), ' ', '-')),
    s."schoolId",
    UPPER(REPLACE(TRIM(s."previousSchoolCity"), ' ', '-')),
    TRIM(s."previousSchoolCity"),
    NULL,
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "students" s
WHERE s."previousSchoolCity" IS NOT NULL
  AND TRIM(s."previousSchoolCity") <> ''
  AND NOT EXISTS (
      SELECT 1 FROM "cities" c
      WHERE c."schoolId" = s."schoolId" AND c."name" = TRIM(s."previousSchoolCity")
  )
GROUP BY s."schoolId", TRIM(s."previousSchoolCity");

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
    CONSTRAINT "students_previousSchoolCityId_fkey" FOREIGN KEY ("previousSchoolCityId") REFERENCES "cities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- The two city columns are resolved through the rows just inserted, which is
-- the whole point of doing the backfill first: a plain column drop would throw
-- away every birthplace in the school.
INSERT INTO "new_students" ("allergies", "birthCityId", "birthDate", "birthRank", "bloodType", "brotherCount", "chronicCondition", "code", "createdAt", "doctorName", "doctorPhone", "entryDate", "exitDate", "familyId", "firstName", "firstNameAr", "gender", "hasDisability", "id", "insurer", "isActive", "isOrphan", "lastName", "lastNameAr", "livesWith", "massarCode", "medicalNotes", "medications", "nationalId", "nationality", "notes", "photoUrl", "previousLevel", "previousSchool", "previousSchoolCityId", "schoolId", "schoolingType", "sisterCount", "status", "transferReason", "updatedAt")
SELECT
    s."allergies",
    (SELECT c."id" FROM "cities" c WHERE c."schoolId" = s."schoolId" AND c."name" = TRIM(s."birthPlace")),
    s."birthDate", s."birthRank", s."bloodType", s."brotherCount", s."chronicCondition", s."code", s."createdAt", s."doctorName", s."doctorPhone", s."entryDate", s."exitDate", s."familyId", s."firstName", s."firstNameAr", s."gender", s."hasDisability", s."id", s."insurer", s."isActive", s."isOrphan", s."lastName", s."lastNameAr", s."livesWith", s."massarCode", s."medicalNotes", s."medications", s."nationalId", s."nationality", s."notes", s."photoUrl", s."previousLevel", s."previousSchool",
    (SELECT c."id" FROM "cities" c WHERE c."schoolId" = s."schoolId" AND c."name" = TRIM(s."previousSchoolCity")),
    s."schoolId", s."schoolingType", s."sisterCount", s."status", s."transferReason", s."updatedAt"
FROM "students" s;
DROP TABLE "students";
ALTER TABLE "new_students" RENAME TO "students";
CREATE INDEX "students_schoolId_idx" ON "students"("schoolId");
CREATE INDEX "students_familyId_idx" ON "students"("familyId");
CREATE INDEX "students_birthCityId_idx" ON "students"("birthCityId");
CREATE INDEX "students_previousSchoolCityId_idx" ON "students"("previousSchoolCityId");
CREATE INDEX "students_schoolId_lastName_idx" ON "students"("schoolId", "lastName");
CREATE INDEX "students_schoolId_status_idx" ON "students"("schoolId", "status");
CREATE UNIQUE INDEX "students_schoolId_code_key" ON "students"("schoolId", "code");
CREATE UNIQUE INDEX "students_schoolId_massarCode_key" ON "students"("schoolId", "massarCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
