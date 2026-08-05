-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "modelYear" INTEGER,
    "seatCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "insuranceExpiresOn" DATETIME,
    "inspectionExpiresOn" DATETIME,
    "driverId" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "attendantId" TEXT,
    "attendantName" TEXT,
    "attendantPhone" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicles_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "vehicles_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_vehicles" ("createdAt", "driverId", "driverName", "driverPhone", "id", "inspectionExpiresOn", "insuranceExpiresOn", "make", "model", "modelYear", "notes", "registration", "schoolId", "seatCount", "status", "updatedAt") SELECT "createdAt", "driverId", "driverName", "driverPhone", "id", "inspectionExpiresOn", "insuranceExpiresOn", "make", "model", "modelYear", "notes", "registration", "schoolId", "seatCount", "status", "updatedAt" FROM "vehicles";
DROP TABLE "vehicles";
ALTER TABLE "new_vehicles" RENAME TO "vehicles";
CREATE INDEX "vehicles_schoolId_idx" ON "vehicles"("schoolId");
CREATE INDEX "vehicles_driverId_idx" ON "vehicles"("driverId");
CREATE INDEX "vehicles_attendantId_idx" ON "vehicles"("attendantId");
CREATE INDEX "vehicles_schoolId_status_idx" ON "vehicles"("schoolId", "status");
CREATE UNIQUE INDEX "vehicles_schoolId_registration_key" ON "vehicles"("schoolId", "registration");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

