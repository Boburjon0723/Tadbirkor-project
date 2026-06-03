-- =============================================================================
-- Axis ERP — POS chakana mijozlar + nasiya (qarz)
-- Supabase → SQL Editor → New query → Run
-- Migratsiya: 20260521120000_pos_retail_customers
-- =============================================================================
-- Oldin tekshirish (ixtiyoriy):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'Company' AND column_name = 'posCreditEnabled';
-- Agar qator qaytsa — bu migratsiya allaqachon qo‘llangan.
-- =============================================================================

BEGIN;

-- 1) Kompaniya: POS nasiya yoqish/o‘chirish
ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "posCreditEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 2) POS chek: mijoz
ALTER TABLE "PosSale"
  ADD COLUMN IF NOT EXISTS "retailCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "customerNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customerPhoneSnapshot" TEXT;

-- 3) POS qator: listPrice (narx snapshot)
ALTER TABLE "PosSaleItem"
  ADD COLUMN IF NOT EXISTS "listPrice" DECIMAL(15,2);

-- 4) Chakana mijozlar (B2B Partner emas)
CREATE TABLE IF NOT EXISTS "RetailCustomer" (
  "id"         TEXT NOT NULL,
  "companyId"  TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "phone"      TEXT,
  "isGuest"    BOOLEAN NOT NULL DEFAULT false,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetailCustomer_pkey" PRIMARY KEY ("id")
);

-- 5) Mijozlar qarzi (POS nasiya cheki)
CREATE TABLE IF NOT EXISTS "RetailReceivable" (
  "id"               TEXT NOT NULL,
  "companyId"        TEXT NOT NULL,
  "retailCustomerId" TEXT NOT NULL,
  "posSaleId"        TEXT NOT NULL,
  "amount"           DECIMAL(15,2) NOT NULL,
  "remainingAmount"  DECIMAL(15,2) NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'UZS',
  "status"           TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetailReceivable_pkey" PRIMARY KEY ("id")
);

-- 6) Qarzga to‘lovlar
CREATE TABLE IF NOT EXISTS "RetailReceivablePayment" (
  "id"          TEXT NOT NULL,
  "receivableId" TEXT NOT NULL,
  "amount"      DECIMAL(15,2) NOT NULL,
  "notes"       TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetailReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- 7) Indekslar
CREATE UNIQUE INDEX IF NOT EXISTS "RetailReceivable_posSaleId_key"
  ON "RetailReceivable"("posSaleId");

CREATE INDEX IF NOT EXISTS "RetailCustomer_companyId_idx"
  ON "RetailCustomer"("companyId");

CREATE INDEX IF NOT EXISTS "RetailCustomer_companyId_name_idx"
  ON "RetailCustomer"("companyId", "name");

CREATE INDEX IF NOT EXISTS "RetailReceivable_companyId_status_idx"
  ON "RetailReceivable"("companyId", "status");

CREATE INDEX IF NOT EXISTS "RetailReceivable_retailCustomerId_idx"
  ON "RetailReceivable"("retailCustomerId");

CREATE INDEX IF NOT EXISTS "RetailReceivablePayment_receivableId_idx"
  ON "RetailReceivablePayment"("receivableId");

CREATE INDEX IF NOT EXISTS "PosSale_retailCustomerId_idx"
  ON "PosSale"("retailCustomerId");

-- 8) Foreign key lar
ALTER TABLE "RetailCustomer"
  DROP CONSTRAINT IF EXISTS "RetailCustomer_companyId_fkey";
ALTER TABLE "RetailCustomer"
  ADD CONSTRAINT "RetailCustomer_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetailReceivable"
  DROP CONSTRAINT IF EXISTS "RetailReceivable_companyId_fkey";
ALTER TABLE "RetailReceivable"
  ADD CONSTRAINT "RetailReceivable_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetailReceivable"
  DROP CONSTRAINT IF EXISTS "RetailReceivable_retailCustomerId_fkey";
ALTER TABLE "RetailReceivable"
  ADD CONSTRAINT "RetailReceivable_retailCustomerId_fkey"
  FOREIGN KEY ("retailCustomerId") REFERENCES "RetailCustomer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetailReceivable"
  DROP CONSTRAINT IF EXISTS "RetailReceivable_posSaleId_fkey";
ALTER TABLE "RetailReceivable"
  ADD CONSTRAINT "RetailReceivable_posSaleId_fkey"
  FOREIGN KEY ("posSaleId") REFERENCES "PosSale"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetailReceivablePayment"
  DROP CONSTRAINT IF EXISTS "RetailReceivablePayment_receivableId_fkey";
ALTER TABLE "RetailReceivablePayment"
  ADD CONSTRAINT "RetailReceivablePayment_receivableId_fkey"
  FOREIGN KEY ("receivableId") REFERENCES "RetailReceivable"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetailReceivablePayment"
  DROP CONSTRAINT IF EXISTS "RetailReceivablePayment_createdById_fkey";
ALTER TABLE "RetailReceivablePayment"
  ADD CONSTRAINT "RetailReceivablePayment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PosSale"
  DROP CONSTRAINT IF EXISTS "PosSale_retailCustomerId_fkey";
ALTER TABLE "PosSale"
  ADD CONSTRAINT "PosSale_retailCustomerId_fkey"
  FOREIGN KEY ("retailCustomerId") REFERENCES "RetailCustomer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

-- =============================================================================
-- Prisma ga “qo‘llangan” deb belgilash (lokalda, pooler muammosiz):
--   cd apps/api
--   npx prisma migrate resolve --applied 20260521120000_pos_retail_customers
-- =============================================================================
