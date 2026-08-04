-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "scopeKey" TEXT NOT NULL,
    CONSTRAINT "transport_subscriptions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport_routes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "route_stops" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transport_subscriptions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "transport_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- scopeKey is backfilled here rather than left to a default, matching
-- `subscriptionScopeKey` in modules/transport/enums.ts: the named run wins
-- when there is one, else the direction. Any two rows that land on the same
-- key here were already impossible under the old [enrollmentId, direction]
-- constraint, so this cannot collide.
INSERT INTO "new_transport_subscriptions" ("id", "enrollmentId", "routeId", "stopId", "direction", "scheduleId", "status", "startsOn", "endsOn", "notes", "createdAt", "updatedAt", "scopeKey")
SELECT "id", "enrollmentId", "routeId", "stopId", "direction", "scheduleId", "status", "startsOn", "endsOn", "notes", "createdAt", "updatedAt",
  CASE WHEN "scheduleId" IS NOT NULL THEN 'run:' || "scheduleId" ELSE 'direction:' || "direction" END
FROM "transport_subscriptions";
DROP TABLE "transport_subscriptions";
ALTER TABLE "new_transport_subscriptions" RENAME TO "transport_subscriptions";
CREATE INDEX "transport_subscriptions_enrollmentId_idx" ON "transport_subscriptions"("enrollmentId");
CREATE INDEX "transport_subscriptions_routeId_idx" ON "transport_subscriptions"("routeId");
CREATE INDEX "transport_subscriptions_stopId_idx" ON "transport_subscriptions"("stopId");
CREATE INDEX "transport_subscriptions_scheduleId_idx" ON "transport_subscriptions"("scheduleId");
CREATE INDEX "transport_subscriptions_routeId_status_idx" ON "transport_subscriptions"("routeId", "status");
CREATE UNIQUE INDEX "transport_subscriptions_enrollmentId_scopeKey_key" ON "transport_subscriptions"("enrollmentId", "scopeKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
