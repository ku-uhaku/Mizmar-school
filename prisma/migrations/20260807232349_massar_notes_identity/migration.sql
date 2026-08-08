-- AlterTable
ALTER TABLE "assessments" ADD COLUMN "massarCode" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN "massarNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "assessments_schoolId_massarCode_key" ON "assessments"("schoolId", "massarCode");

-- CreateIndex
CREATE UNIQUE INDEX "students_schoolId_massarNumber_key" ON "students"("schoolId", "massarNumber");

