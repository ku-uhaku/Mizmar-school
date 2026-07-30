-- CreateTable
CREATE TABLE "enrollment_fees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "feeRateId" TEXT,
    "periodIndex" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "dueMonth" INTEGER NOT NULL,
    "dueYear" INTEGER NOT NULL,
    "baseAmountCentimes" INTEGER NOT NULL,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "discountCentimes" INTEGER NOT NULL DEFAULT 0,
    "discountId" TEXT,
    "amountCentimes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "enrollment_fees_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollment_fees_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "fee_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "enrollment_fees_feeRateId_fkey" FOREIGN KEY ("feeRateId") REFERENCES "fee_rates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "enrollment_fees_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "discounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "levelOfferingId" TEXT NOT NULL,
    "schoolClassId" TEXT,
    "classGroupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftOn" DATETIME,
    "isRepeating" BOOLEAN NOT NULL DEFAULT false,
    "usesTransport" BOOLEAN NOT NULL DEFAULT false,
    "usesCanteen" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollments_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollments_levelOfferingId_fkey" FOREIGN KEY ("levelOfferingId") REFERENCES "level_offerings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "enrollments_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "enrollments_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "situation" TEXT NOT NULL DEFAULT 'MARRIED',
    "addressLine" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "families_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "guardians" (
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
    "profession" TEXT,
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
    CONSTRAINT "guardians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "students" (
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
    "medicalNotes" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "students_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "enrollment_fees_enrollmentId_idx" ON "enrollment_fees"("enrollmentId");

-- CreateIndex
CREATE INDEX "enrollment_fees_feeTypeId_idx" ON "enrollment_fees"("feeTypeId");

-- CreateIndex
CREATE INDEX "enrollment_fees_feeRateId_idx" ON "enrollment_fees"("feeRateId");

-- CreateIndex
CREATE INDEX "enrollment_fees_discountId_idx" ON "enrollment_fees"("discountId");

-- CreateIndex
CREATE INDEX "enrollment_fees_dueYear_dueMonth_idx" ON "enrollment_fees"("dueYear", "dueMonth");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_fees_enrollmentId_feeTypeId_periodIndex_key" ON "enrollment_fees"("enrollmentId", "feeTypeId", "periodIndex");

-- CreateIndex
CREATE INDEX "enrollments_schoolYearId_idx" ON "enrollments"("schoolYearId");

-- CreateIndex
CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");

-- CreateIndex
CREATE INDEX "enrollments_levelOfferingId_idx" ON "enrollments"("levelOfferingId");

-- CreateIndex
CREATE INDEX "enrollments_schoolClassId_idx" ON "enrollments"("schoolClassId");

-- CreateIndex
CREATE INDEX "enrollments_classGroupId_idx" ON "enrollments"("classGroupId");

-- CreateIndex
CREATE INDEX "enrollments_schoolYearId_status_idx" ON "enrollments"("schoolYearId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_studentId_schoolYearId_key" ON "enrollments"("studentId", "schoolYearId");

-- CreateIndex
CREATE INDEX "families_schoolId_idx" ON "families"("schoolId");

-- CreateIndex
CREATE INDEX "families_schoolId_name_idx" ON "families"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "families_schoolId_code_key" ON "families"("schoolId", "code");

-- CreateIndex
CREATE INDEX "guardians_familyId_idx" ON "guardians"("familyId");

-- CreateIndex
CREATE INDEX "guardians_userId_idx" ON "guardians"("userId");

-- CreateIndex
CREATE INDEX "guardians_lastName_idx" ON "guardians"("lastName");

-- CreateIndex
CREATE INDEX "students_schoolId_idx" ON "students"("schoolId");

-- CreateIndex
CREATE INDEX "students_familyId_idx" ON "students"("familyId");

-- CreateIndex
CREATE INDEX "students_schoolId_lastName_idx" ON "students"("schoolId", "lastName");

-- CreateIndex
CREATE INDEX "students_schoolId_status_idx" ON "students"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "students_schoolId_code_key" ON "students"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "students_schoolId_massarCode_key" ON "students"("schoolId", "massarCode");
