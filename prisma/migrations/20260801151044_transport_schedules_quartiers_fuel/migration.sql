-- CreateTable
CREATE TABLE "fuel_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "occurredOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "litresTenths" INTEGER NOT NULL DEFAULT 0,
    "odometerKm" INTEGER,
    "amountCentimes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "cashOperationId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fuel_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fuel_requests_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fuel_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fuel_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fuel_requests_cashOperationId_fkey" FOREIGN KEY ("cashOperationId") REFERENCES "cash_operations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "route_neighbourhoods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "neighbourhoodId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "route_neighbourhoods_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "route_neighbourhoods_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "neighbourhoods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "route_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "route_schedules_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "route_schedules_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "transport_schedules" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transport_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'MORNING',
    "departureTime" TEXT NOT NULL,
    "arrivalTime" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transport_schedules_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transport_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "zoneId" TEXT,
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
    CONSTRAINT "transport_subscriptions_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "transport_zones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "transport_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transport_subscriptions" ("createdAt", "direction", "endsOn", "enrollmentId", "id", "notes", "routeId", "startsOn", "status", "stopId", "updatedAt", "zoneId") SELECT "createdAt", "direction", "endsOn", "enrollmentId", "id", "notes", "routeId", "startsOn", "status", "stopId", "updatedAt", "zoneId" FROM "transport_subscriptions";
DROP TABLE "transport_subscriptions";
ALTER TABLE "new_transport_subscriptions" RENAME TO "transport_subscriptions";
CREATE INDEX "transport_subscriptions_enrollmentId_idx" ON "transport_subscriptions"("enrollmentId");
CREATE INDEX "transport_subscriptions_routeId_idx" ON "transport_subscriptions"("routeId");
CREATE INDEX "transport_subscriptions_stopId_idx" ON "transport_subscriptions"("stopId");
CREATE INDEX "transport_subscriptions_zoneId_idx" ON "transport_subscriptions"("zoneId");
CREATE INDEX "transport_subscriptions_scheduleId_idx" ON "transport_subscriptions"("scheduleId");
CREATE INDEX "transport_subscriptions_routeId_status_idx" ON "transport_subscriptions"("routeId", "status");
CREATE UNIQUE INDEX "transport_subscriptions_enrollmentId_direction_key" ON "transport_subscriptions"("enrollmentId", "direction");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "fuel_requests_cashOperationId_key" ON "fuel_requests"("cashOperationId");

-- CreateIndex
CREATE INDEX "fuel_requests_schoolId_idx" ON "fuel_requests"("schoolId");

-- CreateIndex
CREATE INDEX "fuel_requests_vehicleId_idx" ON "fuel_requests"("vehicleId");

-- CreateIndex
CREATE INDEX "fuel_requests_requestedById_idx" ON "fuel_requests"("requestedById");

-- CreateIndex
CREATE INDEX "fuel_requests_decidedById_idx" ON "fuel_requests"("decidedById");

-- CreateIndex
CREATE INDEX "fuel_requests_schoolId_status_idx" ON "fuel_requests"("schoolId", "status");

-- CreateIndex
CREATE INDEX "fuel_requests_vehicleId_occurredOn_idx" ON "fuel_requests"("vehicleId", "occurredOn");

-- CreateIndex
CREATE INDEX "route_neighbourhoods_routeId_idx" ON "route_neighbourhoods"("routeId");

-- CreateIndex
CREATE INDEX "route_neighbourhoods_neighbourhoodId_idx" ON "route_neighbourhoods"("neighbourhoodId");

-- CreateIndex
CREATE UNIQUE INDEX "route_neighbourhoods_routeId_neighbourhoodId_key" ON "route_neighbourhoods"("routeId", "neighbourhoodId");

-- CreateIndex
CREATE INDEX "route_schedules_routeId_idx" ON "route_schedules"("routeId");

-- CreateIndex
CREATE INDEX "route_schedules_scheduleId_idx" ON "route_schedules"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "route_schedules_routeId_scheduleId_key" ON "route_schedules"("routeId", "scheduleId");

-- CreateIndex
CREATE INDEX "transport_schedules_schoolYearId_idx" ON "transport_schedules"("schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_schedules_schoolYearId_code_key" ON "transport_schedules"("schoolYearId", "code");

