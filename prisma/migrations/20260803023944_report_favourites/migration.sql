-- CreateTable
CREATE TABLE "report_favourites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "report_favourites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "report_favourites_userId_idx" ON "report_favourites"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "report_favourites_userId_reportId_key" ON "report_favourites"("userId", "reportId");

