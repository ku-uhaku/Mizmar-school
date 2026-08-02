-- CreateTable
CREATE TABLE "document_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "copies" INTEGER,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "document_types_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "student_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "receivedOn" DATETIME,
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "student_documents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_documents_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "student_documents_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "document_types_schoolId_idx" ON "document_types"("schoolId");

-- CreateIndex
CREATE INDEX "document_types_schoolId_isActive_idx" ON "document_types"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_schoolId_code_key" ON "document_types"("schoolId", "code");

-- CreateIndex
CREATE INDEX "student_documents_studentId_idx" ON "student_documents"("studentId");

-- CreateIndex
CREATE INDEX "student_documents_documentTypeId_idx" ON "student_documents"("documentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "student_documents_studentId_documentTypeId_key" ON "student_documents"("studentId", "documentTypeId");

