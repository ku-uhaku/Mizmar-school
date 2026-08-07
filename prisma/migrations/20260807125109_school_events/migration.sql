-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "isSchoolWide" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" DATETIME,
    "publishedById" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "events_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "events_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_audiences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "levelId" TEXT,
    "schoolClassId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "event_audiences_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_audiences_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_audiences_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "events_schoolId_idx" ON "events"("schoolId");

-- CreateIndex
CREATE INDEX "events_schoolYearId_idx" ON "events"("schoolYearId");

-- CreateIndex
CREATE INDEX "events_publishedById_idx" ON "events"("publishedById");

-- CreateIndex
CREATE INDEX "events_createdById_idx" ON "events"("createdById");

-- CreateIndex
CREATE INDEX "events_schoolYearId_status_startsAt_idx" ON "events"("schoolYearId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "event_audiences_eventId_idx" ON "event_audiences"("eventId");

-- CreateIndex
CREATE INDEX "event_audiences_levelId_idx" ON "event_audiences"("levelId");

-- CreateIndex
CREATE INDEX "event_audiences_schoolClassId_idx" ON "event_audiences"("schoolClassId");

-- CreateIndex
CREATE UNIQUE INDEX "event_audiences_eventId_levelId_key" ON "event_audiences"("eventId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "event_audiences_eventId_schoolClassId_key" ON "event_audiences"("eventId", "schoolClassId");

