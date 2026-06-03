-- Ombor qoldig'i: dona (butun) va kg/l/m (o'nlik) uchun Decimal
ALTER TABLE "StockBalance"
  ALTER COLUMN "quantity" TYPE DECIMAL(15, 4) USING "quantity"::decimal;

ALTER TABLE "StockBalance"
  ALTER COLUMN "reservedQuantity" TYPE DECIMAL(15, 4) USING "reservedQuantity"::decimal;

ALTER TABLE "StockMovement"
  ALTER COLUMN "quantity" TYPE DECIMAL(15, 4) USING "quantity"::decimal;
