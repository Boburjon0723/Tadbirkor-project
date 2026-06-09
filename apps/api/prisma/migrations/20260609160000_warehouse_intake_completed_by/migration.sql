-- Tasdiqlagan omborchi (nakladnoy uchun)
ALTER TABLE "WarehouseIntake" ADD COLUMN IF NOT EXISTS "completedBy" TEXT;
