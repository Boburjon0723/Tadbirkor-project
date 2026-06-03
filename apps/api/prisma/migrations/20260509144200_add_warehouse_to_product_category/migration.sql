-- Add warehouse binding for product categories
ALTER TABLE "ProductCategory"
ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;

-- Index for faster filtering by warehouse
CREATE INDEX IF NOT EXISTS "ProductCategory_warehouseId_idx"
ON "ProductCategory"("warehouseId");

-- FK to Warehouse table (safe for repeated runs)
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
