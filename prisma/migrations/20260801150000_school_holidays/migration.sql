-- CreateTable
CREATE TABLE "school_holidays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SCHOOL_HOLIDAY',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "school_holidays_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "school_holidays_schoolYearId_idx" ON "school_holidays"("schoolYearId");

-- CreateIndex
CREATE INDEX "school_holidays_schoolYearId_startDate_idx" ON "school_holidays"("schoolYearId", "startDate");

