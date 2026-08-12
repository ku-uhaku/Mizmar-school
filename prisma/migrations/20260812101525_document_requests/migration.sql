-- CreateTable
CREATE TABLE "document_request_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "usualDelayDays" INTEGER,
    "requiresReason" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "document_request_types_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestedById" TEXT,
    "typeId" TEXT NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "readyAt" DATETIME,
    "officeNote" TEXT,
    "handledById" TEXT,
    "handledAt" DATETIME,
    "collectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "document_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "document_requests_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "document_request_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "document_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "document_request_types_schoolId_idx" ON "document_request_types"("schoolId");

-- CreateIndex
CREATE INDEX "document_request_types_schoolId_isActive_idx" ON "document_request_types"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "document_request_types_schoolId_code_key" ON "document_request_types"("schoolId", "code");

-- CreateIndex
CREATE INDEX "document_requests_schoolId_status_idx" ON "document_requests"("schoolId", "status");

-- CreateIndex
CREATE INDEX "document_requests_schoolId_idx" ON "document_requests"("schoolId");

-- CreateIndex
CREATE INDEX "document_requests_studentId_idx" ON "document_requests"("studentId");

-- CreateIndex
CREATE INDEX "document_requests_typeId_idx" ON "document_requests"("typeId");

-- CreateIndex
CREATE INDEX "document_requests_requestedById_idx" ON "document_requests"("requestedById");

-- CreateIndex
CREATE INDEX "document_requests_handledById_idx" ON "document_requests"("handledById");

