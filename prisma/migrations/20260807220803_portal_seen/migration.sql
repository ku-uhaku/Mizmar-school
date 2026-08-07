-- CreateTable
CREATE TABLE "portal_seen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "portal_seen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "portal_seen_userId_idx" ON "portal_seen"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_seen_userId_topic_key" ON "portal_seen"("userId", "topic");

