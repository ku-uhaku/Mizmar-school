-- CreateTable
CREATE TABLE "parent_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "parent_jobs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "staff_functions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "staff_functions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);


-- The FK columns are added bare first, so the backfill below has somewhere to
-- write. The rebuild further down is what puts the actual foreign key on them —
-- it carries these values across, which is the whole point of the ordering.
ALTER TABLE "profiles" ADD COLUMN "jobFunctionId" TEXT;
ALTER TABLE "guardians" ADD COLUMN "parentJobId" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: turn what was typed into what is now configured.
--
-- The rebuilds below drop `profiles.jobTitle` and `guardians.profession`, so
-- every distinct value has to become a row here first and every holder has to
-- be pointed at it. Nothing a school has already typed is lost; it simply
-- becomes an entry they can rename, reorder or deactivate.
--
-- `lower(hex(randomblob(16)))` stands in for the cuid the application would
-- generate. The column is plain TEXT and nothing reads a shape into it.
-- ─────────────────────────────────────────────────────────────────────────────

-- One fonction per (school, spelling) actually held. A user's school is the one
-- they were last working in, falling back to their first membership: a fonction
-- is school-scoped and a profile is not, so the backfill has to choose, and
-- that is the best answer available.
INSERT INTO "staff_functions" ("id", "schoolId", "code", "name", "position", "isActive", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(16))),
    s."schoolId",
    upper(substr(replace(s."jobTitle", ' ', '-'), 1, 32)),
    s."jobTitle",
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT
        p."jobTitle" AS "jobTitle",
        COALESCE(u."currentSchoolId", (
            SELECT m."schoolId" FROM "memberships" m WHERE m."userId" = u."id" LIMIT 1
        )) AS "schoolId"
    FROM "profiles" p
    JOIN "users" u ON u."id" = p."userId"
    WHERE p."jobTitle" IS NOT NULL AND trim(p."jobTitle") <> ''
) s
WHERE s."schoolId" IS NOT NULL;

UPDATE "profiles"
SET "jobFunctionId" = (
    SELECT f."id" FROM "staff_functions" f
    WHERE f."name" = "profiles"."jobTitle"
      AND f."schoolId" = COALESCE(
          (SELECT u."currentSchoolId" FROM "users" u WHERE u."id" = "profiles"."userId"),
          (SELECT m."schoolId" FROM "memberships" m WHERE m."userId" = "profiles"."userId" LIMIT 1)
      )
)
WHERE "jobTitle" IS NOT NULL AND trim("jobTitle") <> '';

-- The same for the parents. A guardian's school is unambiguous — it comes
-- through the dossier familial, which belongs to exactly one.
INSERT INTO "parent_jobs" ("id", "schoolId", "code", "name", "position", "isActive", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(16))),
    s."schoolId",
    upper(substr(replace(s."profession", ' ', '-'), 1, 32)),
    s."profession",
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT g."profession" AS "profession", f."schoolId" AS "schoolId"
    FROM "guardians" g
    JOIN "families" f ON f."id" = g."familyId"
    WHERE g."profession" IS NOT NULL AND trim(g."profession") <> ''
) s;

UPDATE "guardians"
SET "parentJobId" = (
    SELECT j."id" FROM "parent_jobs" j
    WHERE j."name" = "guardians"."profession"
      AND j."schoolId" = (
          SELECT f."schoolId" FROM "families" f WHERE f."id" = "guardians"."familyId"
      )
)
WHERE "profession" IS NOT NULL AND trim("profession") <> '';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_guardians" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nameAr" TEXT,
    "nationalId" TEXT,
    "phone" TEXT,
    "phoneAlt" TEXT,
    "email" TEXT,
    "parentJobId" TEXT,
    "employer" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "canPickUp" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "guardians_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "guardians_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "parent_jobs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "guardians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_guardians" ("parentJobId", "addressLine", "canPickUp", "city", "createdAt", "email", "employer", "familyId", "firstName", "id", "isActive", "isEmergencyContact", "isPrimaryContact", "lastName", "nameAr", "nationalId", "notes", "phone", "phoneAlt", "relationship", "updatedAt", "userId") SELECT "parentJobId", "addressLine", "canPickUp", "city", "createdAt", "email", "employer", "familyId", "firstName", "id", "isActive", "isEmergencyContact", "isPrimaryContact", "lastName", "nameAr", "nationalId", "notes", "phone", "phoneAlt", "relationship", "updatedAt", "userId" FROM "guardians";
DROP TABLE "guardians";
ALTER TABLE "new_guardians" RENAME TO "guardians";
CREATE INDEX "guardians_familyId_idx" ON "guardians"("familyId");
CREATE INDEX "guardians_userId_idx" ON "guardians"("userId");
CREATE INDEX "guardians_lastName_idx" ON "guardians"("lastName");
CREATE INDEX "guardians_parentJobId_idx" ON "guardians"("parentJobId");
CREATE TABLE "new_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "jobFunctionId" TEXT,
    "birthDate" DATETIME,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "themeMode" TEXT NOT NULL DEFAULT 'system',
    "accent" TEXT NOT NULL DEFAULT 'blue',
    "fontFamily" TEXT NOT NULL DEFAULT 'geist',
    "fontSize" TEXT NOT NULL DEFAULT 'md',
    "radius" TEXT NOT NULL DEFAULT 'md',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "profiles_jobFunctionId_fkey" FOREIGN KEY ("jobFunctionId") REFERENCES "staff_functions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_profiles" ("jobFunctionId", "accent", "avatarUrl", "bio", "birthDate", "createdAt", "firstName", "fontFamily", "fontSize", "id", "lastName", "locale", "phone", "radius", "themeMode", "updatedAt", "userId") SELECT "jobFunctionId", "accent", "avatarUrl", "bio", "birthDate", "createdAt", "firstName", "fontFamily", "fontSize", "id", "lastName", "locale", "phone", "radius", "themeMode", "updatedAt", "userId" FROM "profiles";
DROP TABLE "profiles";
ALTER TABLE "new_profiles" RENAME TO "profiles";
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");
CREATE INDEX "profiles_jobFunctionId_idx" ON "profiles"("jobFunctionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "parent_jobs_schoolId_idx" ON "parent_jobs"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_jobs_schoolId_code_key" ON "parent_jobs"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "parent_jobs_schoolId_name_key" ON "parent_jobs"("schoolId", "name");

-- CreateIndex
CREATE INDEX "staff_functions_schoolId_idx" ON "staff_functions"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_functions_schoolId_code_key" ON "staff_functions"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_functions_schoolId_name_key" ON "staff_functions"("schoolId", "name");

