-- StockBalance: companyId + productVariantId bo'yicha tez qidiruv (XATOLAR #33)
CREATE INDEX IF NOT EXISTS "StockBalance_companyId_productVariantId_idx"
ON "StockBalance"("companyId", "productVariantId");
