-- Final touch migration (manual run for Supabase SQL Editor)

-- 1) B2B order item currency
ALTER TABLE "B2BOrderItem"
ADD COLUMN IF NOT EXISTS "expectedCurrency" TEXT NOT NULL DEFAULT 'UZS';

-- 2) Debt currency
ALTER TABLE "DebtEntry"
ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'UZS';

-- 3) Warehouse configurable product columns
ALTER TABLE "Warehouse"
ADD COLUMN IF NOT EXISTS "fieldConfig" JSONB;

-- Optional backfill for old rows
UPDATE "Warehouse"
SET "fieldConfig" = COALESCE(
  "fieldConfig",
  '{
    "showImage": true,
    "showDescription": true,
    "showSku": true,
    "showBarcode": false,
    "showColor": true,
    "showPurchasePrice": true,
    "showSalePrice": true
  }'::jsonb
)
WHERE "fieldConfig" IS NULL;

-- 4) ProductCategory -> Warehouse binding
ALTER TABLE "ProductCategory"
ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;

CREATE INDEX IF NOT EXISTS "ProductCategory_warehouseId_idx"
ON "ProductCategory"("warehouseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductCategory_warehouseId_fkey'
  ) THEN
    ALTER TABLE "ProductCategory"
    ADD CONSTRAINT "ProductCategory_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
