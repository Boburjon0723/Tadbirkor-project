-- Ombor kirimi sozlamalari (kompaniya) + qator skaner hisobi

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "warehouseIntakeSettings" JSONB;

ALTER TABLE "WarehouseIntakeLine"
  ADD COLUMN IF NOT EXISTS "scanCount" INTEGER NOT NULL DEFAULT 0;
