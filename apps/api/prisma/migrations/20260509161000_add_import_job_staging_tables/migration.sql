CREATE TABLE IF NOT EXISTS "ProductImportJob" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "processedRows" INTEGER NOT NULL DEFAULT 0,
  "successRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductImportStagingRow" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImportStagingRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductImportJob_companyId_status_idx"
ON "ProductImportJob" ("companyId", "status");

CREATE INDEX IF NOT EXISTS "ProductImportJob_createdAt_idx"
ON "ProductImportJob" ("createdAt");

CREATE INDEX IF NOT EXISTS "ProductImportStagingRow_jobId_status_idx"
ON "ProductImportStagingRow" ("jobId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductImportStagingRow_jobId_rowIndex_key"
ON "ProductImportStagingRow" ("jobId", "rowIndex");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductImportStagingRow_jobId_fkey'
  ) THEN
    ALTER TABLE "ProductImportStagingRow"
    ADD CONSTRAINT "ProductImportStagingRow_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "ProductImportJob"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
