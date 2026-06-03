-- Migration: add_pick_tasks

DO $$ BEGIN
  CREATE TYPE "PickStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PickTask" (
  "id" TEXT NOT NULL,
  "dispatchId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "binLocation" TEXT,
  "quantityRequired" DECIMAL(15,4) NOT NULL,
  "quantityPicked" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "scannedBarcodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "assignedTo" TEXT,
  "status" "PickStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PickTask_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PickTask"
    ADD CONSTRAINT "PickTask_dispatchId_fkey"
      FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PickTask"
    ADD CONSTRAINT "PickTask_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PickTask"
    ADD CONSTRAINT "PickTask_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PickTask"
    ADD CONSTRAINT "PickTask_productVariantId_fkey"
      FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PickTask"
    ADD CONSTRAINT "PickTask_assignedTo_fkey"
      FOREIGN KEY ("assignedTo") REFERENCES "CompanyUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "PickTask_dispatchId_idx" ON "PickTask"("dispatchId");
CREATE INDEX IF NOT EXISTS "PickTask_companyId_status_idx" ON "PickTask"("companyId", "status");
CREATE INDEX IF NOT EXISTS "PickTask_warehouseId_status_idx" ON "PickTask"("warehouseId", "status");
CREATE INDEX IF NOT EXISTS "PickTask_assignedTo_status_idx" ON "PickTask"("assignedTo", "status");
CREATE INDEX IF NOT EXISTS "PickTask_productVariantId_idx" ON "PickTask"("productVariantId");