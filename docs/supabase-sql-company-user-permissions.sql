-- Jamoa a’zosi uchun qo‘shimcha ruxsatlar (grant/deny)
ALTER TABLE "CompanyUser"
  ADD COLUMN IF NOT EXISTS "grantPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "CompanyUser"
  ADD COLUMN IF NOT EXISTS "denyPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
