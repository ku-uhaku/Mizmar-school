-- AlterTable
ALTER TABLE "classes" ADD COLUMN "massarCode" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "massarCode" TEXT;

-- AlterTable
ALTER TABLE "terms" ADD COLUMN "massarCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "classes_schoolId_massarCode_key" ON "classes"("schoolId", "massarCode");

-- CreateIndex
CREATE UNIQUE INDEX "schools_organizationId_massarCode_key" ON "schools"("organizationId", "massarCode");

-- CreateIndex
CREATE UNIQUE INDEX "terms_schoolYearId_massarCode_key" ON "terms"("schoolYearId", "massarCode");

