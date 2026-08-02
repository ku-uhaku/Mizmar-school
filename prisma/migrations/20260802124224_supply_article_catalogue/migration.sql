-- CreateTable
CREATE TABLE "supply_articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "category" TEXT NOT NULL,
    "defaultQuantity" INTEGER,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "supply_articles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_supply_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "articleId" TEXT,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "quantity" INTEGER,
    "notes" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "supply_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "supply_lists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supply_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "supply_articles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_supply_items" ("createdAt", "id", "isRequired", "label", "labelAr", "listId", "notes", "position", "quantity", "updatedAt") SELECT "createdAt", "id", "isRequired", "label", "labelAr", "listId", "notes", "position", "quantity", "updatedAt" FROM "supply_items";
DROP TABLE "supply_items";
ALTER TABLE "new_supply_items" RENAME TO "supply_items";
CREATE INDEX "supply_items_listId_idx" ON "supply_items"("listId");
CREATE INDEX "supply_items_articleId_idx" ON "supply_items"("articleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "supply_articles_schoolId_idx" ON "supply_articles"("schoolId");

-- CreateIndex
CREATE INDEX "supply_articles_schoolId_category_idx" ON "supply_articles"("schoolId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "supply_articles_schoolId_code_key" ON "supply_articles"("schoolId", "code");

