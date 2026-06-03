-- =============================================================================
-- Kompaniya omboridagi mahsulotlarni tozalash (PostgreSQL / Supabase SQL Editor)
-- DIQQAT: Qaytarib bo'lmaydi. Avval backup oling.
-- =============================================================================
-- 1) Quyidagilarni o'zingizning qiymatingiz bilan almashtiring:
--    Kompaniya nomi yoki to'g'ridan-to'g'ri company_id (UUID)

-- Kompaniya ID ni topish (nom bo'yicha):
-- SELECT id, name FROM "Company" WHERE name ILIKE '%Kompaniya nomi%';

BEGIN;

-- >>> BURAYA company_id yozing <<<
-- Masalan: \set company_id 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- SQL Editor da odatda to'g'ridan-to'g'ri qo'yiladi:

DO $$
DECLARE
  v_company_id TEXT := 'COMPANY_UUID_BU_YERGA';  -- majburiy
  v_warehouse_id TEXT := NULL;  -- faqat bitta ombor uchun UUID; hammasi uchun NULL qoldiring
BEGIN
  IF v_company_id = 'COMPANY_UUID_BU_YERGA' THEN
    RAISE EXCEPTION 'Avval v_company_id ni haqiqiy Company UUID bilan almashtiring';
  END IF;

  -- ---------------------------------------------------------------------------
  -- VARIANT A: Faqat bitta ombordagi ZAXIRA (mahsulot kartochkalari qoladi)
  -- ---------------------------------------------------------------------------
  IF v_warehouse_id IS NOT NULL THEN
    DELETE FROM "StockMovement"
    WHERE "companyId" = v_company_id AND "warehouseId" = v_warehouse_id;

    DELETE FROM "StockBalance"
    WHERE "companyId" = v_company_id AND "warehouseId" = v_warehouse_id;

    RAISE NOTICE 'Ombor zaxirasi tozalandi (warehouseId=%)', v_warehouse_id;
  ELSE
    -- -------------------------------------------------------------------------
    -- VARIANT B: Butun kompaniya katalogi + zaxira (xavfli — hamma mahsulot)
    -- -------------------------------------------------------------------------

    -- Import navbatlari (ixtiyoriy, company bo'yicha)
    DELETE FROM "ProductImportStagingRow"
    WHERE "jobId" IN (
      SELECT id FROM "ProductImportJob" WHERE "companyId" = v_company_id
    );
    DELETE FROM "ProductImportJob" WHERE "companyId" = v_company_id;

    -- POS / maydon (variantga bog'liq)
    DELETE FROM "PosSaleItem"
    WHERE "posSaleId" IN (SELECT id FROM "PosSale" WHERE "companyId" = v_company_id);

    DELETE FROM "PosSale" WHERE "companyId" = v_company_id;

    DELETE FROM "UserStock" WHERE "companyId" = v_company_id;

    -- B2B buyurtma qatorlari (faqat shu kompaniya variantlari)
    DELETE FROM "B2BOrderItem"
    WHERE "productVariantId" IN (
      SELECT id FROM "ProductVariant" WHERE "companyId" = v_company_id
    );

    DELETE FROM "DispatchItem"
    WHERE "productVariantId" IN (
      SELECT id FROM "ProductVariant" WHERE "companyId" = v_company_id
    );

    DELETE FROM "GoodsReceiptItem"
    WHERE "productVariantId" IN (
      SELECT id FROM "ProductVariant" WHERE "companyId" = v_company_id
    );

    DELETE FROM "ProductMapping"
    WHERE "companyId" = v_company_id
       OR "ownProductVariantId" IN (
         SELECT id FROM "ProductVariant" WHERE "companyId" = v_company_id
       );

    -- Zaxira
    DELETE FROM "StockMovement" WHERE "companyId" = v_company_id;
    DELETE FROM "StockBalance" WHERE "companyId" = v_company_id;

    -- Mahsulotlar
    DELETE FROM "ProductVariant" WHERE "companyId" = v_company_id;
    DELETE FROM "Product" WHERE "companyId" = v_company_id;

    -- Kategoriyalar (ixtiyoriy — mahsulotlar o'chgandan keyin)
    DELETE FROM "ProductCategory" WHERE "companyId" = v_company_id;

    RAISE NOTICE 'Kompaniya katalogi va zaxirasi tozalandi (companyId=%)', v_company_id;
  END IF;
END $$;

-- Tekshiruv:
-- SELECT COUNT(*) FROM "Product" WHERE "companyId" = 'COMPANY_UUID_BU_YERGA';
-- SELECT COUNT(*) FROM "StockBalance" WHERE "companyId" = 'COMPANY_UUID_BU_YERGA';

-- Tayyor bo'lsa:
-- COMMIT;

-- Bekor qilish:
-- ROLLBACK;
