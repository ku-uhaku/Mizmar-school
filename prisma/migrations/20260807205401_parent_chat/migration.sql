-- CreateTable
CREATE TABLE "chat_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "schoolClassId" TEXT,
    "generalKey" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chat_channels_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_channels_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_channels_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chat_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "chat_channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_channels_schoolClassId_key" ON "chat_channels"("schoolClassId");

-- CreateIndex
CREATE INDEX "chat_channels_schoolId_idx" ON "chat_channels"("schoolId");

-- CreateIndex
CREATE INDEX "chat_channels_schoolYearId_kind_idx" ON "chat_channels"("schoolYearId", "kind");

-- CreateIndex
CREATE INDEX "chat_channels_schoolClassId_idx" ON "chat_channels"("schoolClassId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_channels_generalKey_key" ON "chat_channels"("generalKey");

-- CreateIndex
CREATE INDEX "chat_messages_authorId_idx" ON "chat_messages"("authorId");

-- CreateIndex
CREATE INDEX "chat_messages_deletedById_idx" ON "chat_messages"("deletedById");

-- CreateIndex
CREATE INDEX "chat_messages_channelId_deletedAt_createdAt_idx" ON "chat_messages"("channelId", "deletedAt", "createdAt");

