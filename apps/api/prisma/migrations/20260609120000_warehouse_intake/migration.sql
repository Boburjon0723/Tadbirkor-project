-- Ombor kirimi (qo'lda + skaner) — mustaqil hujjat

CREATE TABLE IF NOT EXISTS "WarehouseIntake" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "note" TEXT,
  "partnerLedgerContactId" TEXT,
  "createdBy" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WarehouseIntake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WarehouseIntakeLine" (
  "id" TEXT NOT NULL,
  "intakeId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "quantity" DECIMAL(15,4) NOT NULL,
  "scannedBarcode" TEXT,
  "entryMode" TEXT NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WarehouseIntakeLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseIntake_companyId_reference_key"
  ON "WarehouseIntake"("companyId", "reference");
CREATE INDEX IF NOT EXISTS "WarehouseIntake_companyId_idx"
  ON "WarehouseIntake"("companyId");
CREATE INDEX IF NOT EXISTS "WarehouseIntake_warehouseId_status_idx"
  ON "WarehouseIntake"("warehouseId", "status");
CREATE INDEX IF NOT EXISTS "WarehouseIntake_companyId_status_createdAt_idx"
  ON "WarehouseIntake"("companyId", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseIntakeLine_intakeId_productVariantId_key"
  ON "WarehouseIntakeLine"("intakeId", "productVariantId");
CREATE INDEX IF NOT EXISTS "WarehouseIntakeLine_intakeId_idx"
  ON "WarehouseIntakeLine"("intakeId");
CREATE INDEX IF NOT EXISTS "WarehouseIntakeLine_productVariantId_idx"
  ON "WarehouseIntakeLine"("productVariantId");

DO $$ BEGIN
  ALTER TABLE "WarehouseIntake"
    ADD CONSTRAINT "WarehouseIntake_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WarehouseIntake"
    ADD CONSTRAINT "WarehouseIntake_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WarehouseIntakeLine"
    ADD CONSTRAINT "WarehouseIntakeLine_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "WarehouseIntake"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WarehouseIntakeLine"
    ADD CONSTRAINT "WarehouseIntakeLine_productVariantId_fkey"
    FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
