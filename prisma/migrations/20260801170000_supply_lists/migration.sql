-- CreateTable
CREATE TABLE "supply_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "quantity" INTEGER,
    "notes" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "supply_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "supply_lists" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "supply_lists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "supply_lists_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supply_lists_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supply_lists_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supply_lists_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "supply_lists_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "supply_lists_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "supply_items_listId_idx" ON "supply_items"("listId");

-- CreateIndex
CREATE INDEX "supply_lists_schoolId_idx" ON "supply_lists"("schoolId");

-- CreateIndex
CREATE INDEX "supply_lists_schoolYearId_idx" ON "supply_lists"("schoolYearId");

-- CreateIndex
CREATE INDEX "supply_lists_schoolClassId_idx" ON "supply_lists"("schoolClassId");

-- CreateIndex
CREATE INDEX "supply_lists_subjectId_idx" ON "supply_lists"("subjectId");

-- CreateIndex
CREATE INDEX "supply_lists_authorId_idx" ON "supply_lists"("authorId");

-- CreateIndex
CREATE INDEX "supply_lists_schoolYearId_status_idx" ON "supply_lists"("schoolYearId", "status");

