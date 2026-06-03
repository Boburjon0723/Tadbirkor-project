-- Migration: add_atp_stock_reservation
-- Bosqich 1: ATP rezerv tizimi
-- 1. StockBalance ga blockedQuantity qo'shish
-- 2. StockReservation yangi model
-- 3. ReservationStatus enum

-- 1. StockBalance kengaytirish
ALTER TABLE "StockBalance"
  ADD COLUMN IF NOT EXISTS "blockedQuantity" DECIMAL(15,4) NOT NULL DEFAULT 0;

-- 2. ReservationStatus enum yaratish
DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. StockReservation jadval yaratish
CREATE TABLE IF NOT EXISTS "StockReservation" (
  "id"               TEXT          NOT NULL,
  "companyId"        TEXT          NOT NULL,
  "warehouseId"      TEXT          NOT NULL,
  "productVariantId" TEXT          NOT NULL,
  "orderId"          TEXT          NOT NULL,
  "quantity"         DECIMAL(15,4) NOT NULL,
  "status"           "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt"        TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "B2BOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_stockBalance_fkey"
    FOREIGN KEY ("warehouseId", "productVariantId")
    REFERENCES "StockBalance"("warehouseId", "productVariantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "StockReservation_companyId_idx"
  ON "StockReservation"("companyId");

CREATE INDEX IF NOT EXISTS "StockReservation_orderId_idx"
  ON "StockReservation"("orderId");

CREATE INDEX IF NOT EXISTS "StockReservation_warehouseId_productVariantId_idx"
  ON "StockReservation"("warehouseId", "productVariantId");

CREATE INDEX IF NOT EXISTS "StockReservation_status_idx"
  ON "StockReservation"("status");
