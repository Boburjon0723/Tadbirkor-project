ALTER TABLE "EmployeePayrollProfile" ADD COLUMN IF NOT EXISTS "onPayrollRoster" BOOLEAN NOT NULL DEFAULT false;

-- Avval maosh belgilangan xodimlar oylik ro‘yxatida qolsin
UPDATE "EmployeePayrollProfile" p
SET "onPayrollRoster" = true
WHERE EXISTS (
  SELECT 1 FROM "EmployeeCompensation" c
  WHERE c."companyUserId" = p."companyUserId" AND c."isActive" = true
);
