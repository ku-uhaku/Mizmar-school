-- CreateTable
CREATE TABLE "trip_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "plannedDepartureTime" TEXT NOT NULL,
    "startedAt" DATETIME,
    "startedById" TEXT,
    "arrivedAt" DATETIME,
    "arrivedById" TEXT,
    "vehicleId" TEXT,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "trip_runs_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trip_runs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "transport_schedules" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trip_runs_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "trip_runs_arrivedById_fkey" FOREIGN KEY ("arrivedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "trip_runs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "trip_runs_routeId_idx" ON "trip_runs"("routeId");

-- CreateIndex
CREATE INDEX "trip_runs_scheduleId_idx" ON "trip_runs"("scheduleId");

-- CreateIndex
CREATE INDEX "trip_runs_vehicleId_idx" ON "trip_runs"("vehicleId");

-- CreateIndex
CREATE INDEX "trip_runs_date_status_idx" ON "trip_runs"("date", "status");

-- CreateIndex
CREATE INDEX "trip_runs_startedById_idx" ON "trip_runs"("startedById");

-- CreateIndex
CREATE INDEX "trip_runs_arrivedById_idx" ON "trip_runs"("arrivedById");

-- CreateIndex
CREATE UNIQUE INDEX "trip_runs_routeId_scheduleId_date_key" ON "trip_runs"("routeId", "scheduleId", "date");

