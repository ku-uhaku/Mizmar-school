-- CreateTable
CREATE TABLE "transport_attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "scheduleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "minutesLate" INTEGER,
    "reason" TEXT,
    "isJustified" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scopeKey" TEXT NOT NULL,
    CONSTRAINT "transport_attendance_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "transport_subscriptions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transport_attendance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "transport_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transport_attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "transport_attendance_subscriptionId_idx" ON "transport_attendance"("subscriptionId");

-- CreateIndex
CREATE INDEX "transport_attendance_scheduleId_idx" ON "transport_attendance"("scheduleId");

-- CreateIndex
CREATE INDEX "transport_attendance_recordedById_idx" ON "transport_attendance"("recordedById");

-- CreateIndex
CREATE INDEX "transport_attendance_date_idx" ON "transport_attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "transport_attendance_subscriptionId_date_scopeKey_key" ON "transport_attendance"("subscriptionId", "date", "scopeKey");

