-- CreateTable
CREATE TABLE "neighbourhoods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "landmark" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "neighbourhoods_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "neighbourhoods_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_route_stops" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "landmark" TEXT,
    "neighbourhoodId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "zoneId" TEXT,
    "pickupTime" TEXT,
    "dropoffTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "route_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "route_stops_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "neighbourhoods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "route_stops_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "transport_zones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_route_stops" ("createdAt", "dropoffTime", "id", "landmark", "name", "nameAr", "pickupTime", "position", "routeId", "updatedAt", "zoneId") SELECT "createdAt", "dropoffTime", "id", "landmark", "name", "nameAr", "pickupTime", "position", "routeId", "updatedAt", "zoneId" FROM "route_stops";
DROP TABLE "route_stops";
ALTER TABLE "new_route_stops" RENAME TO "route_stops";
CREATE INDEX "route_stops_routeId_idx" ON "route_stops"("routeId");
CREATE INDEX "route_stops_zoneId_idx" ON "route_stops"("zoneId");
CREATE INDEX "route_stops_neighbourhoodId_idx" ON "route_stops"("neighbourhoodId");
CREATE UNIQUE INDEX "route_stops_routeId_name_key" ON "route_stops"("routeId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "neighbourhoods_schoolId_idx" ON "neighbourhoods"("schoolId");

-- CreateIndex
CREATE INDEX "neighbourhoods_cityId_idx" ON "neighbourhoods"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "neighbourhoods_schoolId_code_key" ON "neighbourhoods"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "neighbourhoods_cityId_name_key" ON "neighbourhoods"("cityId", "name");

