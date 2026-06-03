-- CompanyUser ga warehouseId qo'shish (SALES/WAREHOUSE rollari uchun do'kon/ombor scope).
-- Nullable: OWNER/MANAGER/ACCOUNTANT uchun null qoladi.

ALTER TABLE "CompanyUser"
  ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;

CREATE INDEX IF NOT EXISTS "CompanyUser_warehouseId_idx"
  ON "CompanyUser" ("warehouseId");

CREATE INDEX IF NOT EXISTS "CompanyUser_companyId_userId_idx"
  ON "CompanyUser" ("companyId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompanyUser_warehouseId_fkey'
  ) THEN
    ALTER TABLE "CompanyUser"
      ADD CONSTRAINT "CompanyUser_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
