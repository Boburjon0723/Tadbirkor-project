-- Migration: physical_inventory

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "inventoryVarianceTolerancePct" DECIMAL(5,2) NOT NULL DEFAULT 1;

DO $$ BEGIN
  CREATE TYPE "InventoryCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CountItemStatus" AS ENUM ('PENDING', 'COUNTED', 'APPROVED', 'REJECTED', 'RECOUNTING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BlockReason" AS ENUM ('INVENTORY_COUNT', 'QUALITY_CHECK', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "InventoryCount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "InventoryCountStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "initiatedBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryCountItem" (
  "id" TEXT NOT NULL,
  "inventoryCountId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "binLocation" TEXT,
  "systemQuantity" DECIMAL(15,4) NOT NULL,
  "countedQuantity" DECIMAL(15,4),
  "variance" DECIMAL(15,4),
  "variancePct" DECIMAL(5,2),
  "status" "CountItemStatus" NOT NULL DEFAULT 'PENDING',
  "scannedAt" TIMESTAMP(3),
  "scannedBy" TEXT,
  "note" TEXT,
  CONSTRAINT "InventoryCountItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockBlock" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "reason" "BlockReason" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "blockedQty" DECIMAL(15,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  CONSTRAINT "StockBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCount_companyId_reference_key" ON "InventoryCount"("companyId", "reference");
CREATE INDEX IF NOT EXISTS "InventoryCount_companyId_idx" ON "InventoryCount"("companyId");
CREATE INDEX IF NOT EXISTS "InventoryCount_warehouseId_status_idx" ON "InventoryCount"("warehouseId", "status");
CREATE INDEX IF NOT EXISTS "InventoryCountItem_inventoryCountId_idx" ON "InventoryCountItem"("inventoryCountId");
CREATE INDEX IF NOT EXISTS "InventoryCountItem_productVariantId_idx" ON "InventoryCountItem"("productVariantId");
CREATE UNIQUE INDEX IF NOT EXISTS "StockBlock_warehouseId_productVariantId_reason_sourceId_key" ON "StockBlock"("warehouseId", "productVariantId", "reason", "sourceId");
CREATE INDEX IF NOT EXISTS "StockBlock_companyId_idx" ON "StockBlock"("companyId");
CREATE INDEX IF NOT EXISTS "StockBlock_warehouseId_productVariantId_idx" ON "StockBlock"("warehouseId", "productVariantId");

DO $$ BEGIN
  ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "StockBlock" ADD CONSTRAINT "StockBlock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "StockBlock" ADD CONSTRAINT "StockBlock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "StockBlock" ADD CONSTRAINT "StockBlock_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;