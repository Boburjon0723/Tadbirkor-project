-- Ombor qoldiqlari: warehouse bo'yicha tez filter (db push dan mustaqil, xavfsiz)
CREATE INDEX IF NOT EXISTS "StockBalance_warehouseId_idx"
  ON "StockBalance"("warehouseId");

CREATE INDEX IF NOT EXISTS "StockBalance_companyId_warehouseId_idx"
  ON "StockBalance"("companyId", "warehouseId");
