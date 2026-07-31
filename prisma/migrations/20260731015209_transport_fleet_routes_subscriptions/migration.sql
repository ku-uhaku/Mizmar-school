-- CreateTable
CREATE TABLE "route_stops" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "landmark" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "zoneId" TEXT,
    "pickupTime" TEXT,
    "dropoffTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "route_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "route_stops_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "transport_zones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transport_routes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'BOTH',
    "vehicleId" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transport_routes_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transport_routes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transport_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "zoneId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'BOTH',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transport_subscriptions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "route_stops" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "transport_zones" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transport_zones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolYearId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "amountCentimes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transport_zones_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vehicles" (
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
    "driverName" TEXT,
    "driverPhone" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "route_stops_routeId_idx" ON "route_stops"("routeId");

-- CreateIndex
CREATE INDEX "route_stops_zoneId_idx" ON "route_stops"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "route_stops_routeId_name_key" ON "route_stops"("routeId", "name");

-- CreateIndex
CREATE INDEX "transport_routes_schoolYearId_idx" ON "transport_routes"("schoolYearId");

-- CreateIndex
CREATE INDEX "transport_routes_vehicleId_idx" ON "transport_routes"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_routes_schoolYearId_code_key" ON "transport_routes"("schoolYearId", "code");

-- CreateIndex
CREATE INDEX "transport_subscriptions_enrollmentId_idx" ON "transport_subscriptions"("enrollmentId");

-- CreateIndex
CREATE INDEX "transport_subscriptions_routeId_idx" ON "transport_subscriptions"("routeId");

-- CreateIndex
CREATE INDEX "transport_subscriptions_stopId_idx" ON "transport_subscriptions"("stopId");

-- CreateIndex
CREATE INDEX "transport_subscriptions_zoneId_idx" ON "transport_subscriptions"("zoneId");

-- CreateIndex
CREATE INDEX "transport_subscriptions_routeId_status_idx" ON "transport_subscriptions"("routeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transport_subscriptions_enrollmentId_direction_key" ON "transport_subscriptions"("enrollmentId", "direction");

-- CreateIndex
CREATE INDEX "transport_zones_schoolYearId_idx" ON "transport_zones"("schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_zones_schoolYearId_code_key" ON "transport_zones"("schoolYearId", "code");

-- CreateIndex
CREATE INDEX "vehicles_schoolId_idx" ON "vehicles"("schoolId");

-- CreateIndex
CREATE INDEX "vehicles_schoolId_status_idx" ON "vehicles"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_schoolId_registration_key" ON "vehicles"("schoolId", "registration");

