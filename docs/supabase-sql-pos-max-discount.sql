-- POS kassir chegirma limiti (%). SQL Editor → Run
-- Prisma migratsiya qo‘llangan bo‘lsa ham, ustun yo‘q bo‘lsa xavfsiz.

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "posMaxDiscountPercent" DECIMAL(5, 2);

COMMENT ON COLUMN "Company"."posMaxDiscountPercent" IS 'Kassir chegirma limiti (%); null = 15';
