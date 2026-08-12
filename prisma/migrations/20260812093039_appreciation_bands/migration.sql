-- CreateTable
CREATE TABLE "appreciation_bands" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "minPercentBps" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "colorHex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "appreciation_bands_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "appreciation_bands_schoolId_idx" ON "appreciation_bands"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "appreciation_bands_schoolId_minPercentBps_key" ON "appreciation_bands"("schoolId", "minPercentBps");

