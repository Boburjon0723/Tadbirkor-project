-- POS (Point of Sale) — universal kassa moduli jadvallari.
-- MVP: naqd to'lov, smenasiz, anonim mijoz, umumiy summa chegirmasi.
-- Stock OUT chek yopilganda avto yaratiladi (sourceType: POS_SALE).

CREATE TABLE IF NOT EXISTS "PosSale" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "saleNumber" TEXT NOT NULL,
  "subtotal" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "cashReceived" DECIMAL(15, 2),
  "cashChange" DECIMAL(15, 2),
  "note" TEXT,
  "cashierId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidedById" TEXT,
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PosSaleItem" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "skuSnapshot" TEXT,
  "barcodeSnapshot" TEXT,
  "quantity" DECIMAL(15, 4) NOT NULL,
  "unitPrice" DECIMAL(15, 2) NOT NULL,
  "lineTotal" DECIMAL(15, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosSaleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PosPayment" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "amount" DECIMAL(15, 2) NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosPayment_pkey" PRIMARY KEY ("id")
);

-- Indekslar
CREATE UNIQUE INDEX IF NOT EXISTS "PosSale_companyId_saleNumber_key"
ON "PosSale" ("companyId", "saleNumber");

CREATE INDEX IF NOT EXISTS "PosSale_companyId_status_idx"
ON "PosSale" ("companyId", "status");

CREATE INDEX IF NOT EXISTS "PosSale_companyId_createdAt_idx"
ON "PosSale" ("companyId", "createdAt");

CREATE INDEX IF NOT EXISTS "PosSale_warehouseId_idx"
ON "PosSale" ("warehouseId");

CREATE INDEX IF NOT EXISTS "PosSale_cashierId_idx"
ON "PosSale" ("cashierId");

CREATE INDEX IF NOT EXISTS "PosSaleItem_saleId_idx"
ON "PosSaleItem" ("saleId");

CREATE INDEX IF NOT EXISTS "PosSaleItem_productVariantId_idx"
ON "PosSaleItem" ("productVariantId");

CREATE INDEX IF NOT EXISTS "PosPayment_saleId_idx"
ON "PosPayment" ("saleId");

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosSale_companyId_fkey') THEN
    ALTER TABLE "PosSale"
    ADD CONSTRAINT "PosSale_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosSale_warehouseId_fkey') THEN
    ALTER TABLE "PosSale"
    ADD CONSTRAINT "PosSale_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosSale_cashierId_fkey') THEN
    ALTER TABLE "PosSale"
    ADD CONSTRAINT "PosSale_cashierId_fkey"
    FOREIGN KEY ("cashierId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosSale_voidedById_fkey') THEN
    ALTER TABLE "PosSale"
    ADD CONSTRAINT "PosSale_voidedById_fkey"
    FOREIGN KEY ("voidedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosSaleItem_saleId_fkey') THEN
    ALTER TABLE "PosSaleItem"
    ADD CONSTRAINT "PosSaleItem_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "PosSale"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosSaleItem_productVariantId_fkey') THEN
    ALTER TABLE "PosSaleItem"
    ADD CONSTRAINT "PosSaleItem_productVariantId_fkey"
    FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosPayment_saleId_fkey') THEN
    ALTER TABLE "PosPayment"
    ADD CONSTRAINT "PosPayment_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "PosSale"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
