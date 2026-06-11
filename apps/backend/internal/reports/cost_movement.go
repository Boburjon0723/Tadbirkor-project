package reports

// Shared SQL for Savdo hisoboti — kirim, sotuv (haqiqiy narxlar), tannarx (COGS), yalpi foyda.

// Kirim va ombor qiymati — kirim narxi bo‘sh bo‘lsa sotuv narxi (taxminiy qiymat).
const sqlUnitCostInbound = `COALESCE(NULLIF(pv."purchasePrice", 0), NULLIF(pv."salePrice", 0), 0)`

// Tannarx (COGS) — faqat haqiqiy kirim narxi; bo‘sh bo‘lsa 0 (ma’lumot kiritilmagan).
const sqlUnitCostCOGS = `COALESCE(NULLIF(pv."purchasePrice", 0), 0)`

const sqlInboundFilter = `
  AND sm.type = 'IN'
  AND (
    sm."sourceType" IN ('GOODS_RECEIPT', 'WAREHOUSE_INTAKE', 'PRODUCT_INITIAL')
    OR (sm."sourceType" = 'ADJUSTMENT' AND sm.type = 'IN')
  )`

const sqlOutboundFilter = `AND sm.type = 'OUT'`

// Bekor qilingan POS cheklari sotuvga kirmaydi.
const sqlExcludeVoidedPOS = `
  AND NOT (
    sm."sourceType" = 'POS_SALE'
    AND sm."sourceId" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "PosSale" ps
      WHERE ps.id = sm."sourceId" AND ps.status = 'VOIDED'
    )
  )`

const sqlLineRevenue = `
CASE
  WHEN sm."sourceType" = 'POS_SALE' AND sm."sourceId" IS NOT NULL THEN
    COALESCE((
      SELECT psi."lineTotal"::float8
      FROM "PosSaleItem" psi
      INNER JOIN "PosSale" ps ON ps.id = psi."saleId" AND ps.status = 'COMPLETED'
      WHERE psi."saleId" = sm."sourceId"
        AND psi."productVariantId" = sm."productVariantId"
      LIMIT 1
    ), ABS(sm.quantity)::float8 * COALESCE(NULLIF(pv."salePrice", 0), 0))
  WHEN sm."sourceType" = 'DISPATCH' THEN
    COALESCE((
      SELECT ABS(sm.quantity)::float8 * COALESCE(
        NULLIF(oi."expectedPrice", 0),
        NULLIF(pv."salePrice", 0),
        0
      )
      FROM "Dispatch" d
      INNER JOIN "DispatchItem" di ON di."dispatchId" = d.id
      INNER JOIN "B2BOrderItem" oi
        ON oi."orderId" = d."orderId" AND oi."productVariantId" = di."productVariantId"
      WHERE d."sellerCompanyId" = sm."companyId"
        AND d."warehouseId" = sm."warehouseId"
        AND d.status = 'SENT'
        AND di."productVariantId" = sm."productVariantId"
        AND ABS(di.quantity::float8 - ABS(sm.quantity)::float8) < 0.0001
        AND d."sentAt" IS NOT NULL
        AND ABS(EXTRACT(EPOCH FROM (d."sentAt" - sm."createdAt"))) < 300
      LIMIT 1
    ), ABS(sm.quantity)::float8 * COALESCE(NULLIF(pv."salePrice", 0), 0))
  ELSE
    ABS(sm.quantity)::float8 * COALESCE(NULLIF(pv."salePrice", 0), 0)
END`

const sqlMovementBaseFrom = `
FROM "StockMovement" sm
JOIN "Warehouse" w ON w.id = sm."warehouseId"
JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"`

func movementPeriodWhere(warehouseTail string) string {
	return `
WHERE sm."companyId" = $1
  AND sm."createdAt" >= $2
  AND sm."createdAt" <= $3
  AND w.status <> 'ARCHIVED'` + warehouseTail
}
