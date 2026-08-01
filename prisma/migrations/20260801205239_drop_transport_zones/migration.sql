-- DropIndex
DROP INDEX "transport_zones_schoolYearId_code_key";

-- DropIndex
DROP INDEX "transport_zones_schoolYearId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "transport_zones";
PRAGMA foreign_keys=on;

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
    "pickupTime" TEXT,
    "dropoffTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "route_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "route_stops_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "neighbourhoods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_route_stops" ("createdAt", "dropoffTime", "id", "landmark", "name", "nameAr", "neighbourhoodId", "pickupTime", "position", "routeId", "updatedAt") SELECT "createdAt", "dropoffTime", "id", "landmark", "name", "nameAr", "neighbourhoodId", "pickupTime", "position", "routeId", "updatedAt" FROM "route_stops";
DROP TABLE "route_stops";
ALTER TABLE "new_route_stops" RENAME TO "route_stops";
CREATE INDEX "route_stops_routeId_idx" ON "route_stops"("routeId");
CREATE INDEX "route_stops_neighbourhoodId_idx" ON "route_stops"("neighbourhoodId");
CREATE UNIQUE INDEX "route_stops_routeId_name_key" ON "route_stops"("routeId", "name");
CREATE TABLE "new_transport_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'BOTH',
    "scheduleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transport_subscriptions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "route_stops" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "transport_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transport_subscriptions" ("createdAt", "direction", "endsOn", "enrollmentId", "id", "notes", "routeId", "scheduleId", "startsOn", "status", "stopId", "updatedAt") SELECT "createdAt", "direction", "endsOn", "enrollmentId", "id", "notes", "routeId", "scheduleId", "startsOn", "status", "stopId", "updatedAt" FROM "transport_subscriptions";
DROP TABLE "transport_subscriptions";
ALTER TABLE "new_transport_subscriptions" RENAME TO "transport_subscriptions";
CREATE INDEX "transport_subscriptions_enrollmentId_idx" ON "transport_subscriptions"("enrollmentId");
CREATE INDEX "transport_subscriptions_routeId_idx" ON "transport_subscriptions"("routeId");
CREATE INDEX "transport_subscriptions_stopId_idx" ON "transport_subscriptions"("stopId");
CREATE INDEX "transport_subscriptions_scheduleId_idx" ON "transport_subscriptions"("scheduleId");
CREATE INDEX "transport_subscriptions_routeId_status_idx" ON "transport_subscriptions"("routeId", "status");
CREATE UNIQUE INDEX "transport_subscriptions_enrollmentId_direction_key" ON "transport_subscriptions"("enrollmentId", "direction");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

