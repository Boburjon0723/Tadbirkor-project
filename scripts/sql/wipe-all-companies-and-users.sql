-- =============================================================================
-- BARCHA kompaniyalar, foydalanuvchilar va biznes ma'lumotlarini o'chirish
-- Supabase: SQL Editor → butun faylni tanlang (Ctrl+A) → Run
--
-- SAQLANADI: "Module", "Feature" (tizim katalogi)
-- DIQQAT: Qaytarib bo'lmaydi. Avval backup (Supabase → Database → Backups)
-- =============================================================================

BEGIN;

-- 1-usul: TRUNCATE (tez, FK tartibini CASCADE hal qiladi)
TRUNCATE TABLE
  "FieldTaskApproval",
  "FieldTaskReport",
  "FieldTask",
  "RetailReceivablePayment",
  "RetailReceivable",
  "RetailCustomerLedgerEntry",
  "PosPayment",
  "PosSaleItem",
  "PosSale",
  "RetailCustomer",
  "PartnerLedgerSaleOrderStatus",
  "PartnerLedgerOperation",
  "PartnerLedgerContact",
  "Expense",
  "ExpenseCategory",
  "DebtPaymentRecord",
  "DebtEntry",
  "GoodsReceiptItem",
  "GoodsReceipt",
  "DispatchItem",
  "Dispatch",
  "Invoice",
  "B2BOrderItem",
  "B2BOrder",
  "ProductMapping",
  "ProductImportStagingRow",
  "ProductImportJob",
  "UserStock",
  "StockMovement",
  "StockBalance",
  "ProductVariant",
  "Product",
  "ProductCategory",
  "WorkflowStep",
  "WorkflowDefinition",
  "CompanyFeature",
  "Warehouse",
  "Partner",
  "NotificationDelivery",
  "Notification",
  "Task",
  "TelegramActionRecord",
  "TelegramChatBinding",
  "TelegramBotIntent",
  "AuditLog",
  "CompanyUser",
  "Company",
  "User"
RESTART IDENTITY CASCADE;

-- Tekshiruv (hammasi 0 bo'lishi kerak):
SELECT 'Company' AS tbl, COUNT(*)::int AS cnt FROM "Company"
UNION ALL SELECT 'User', COUNT(*)::int FROM "User"
UNION ALL SELECT 'Product', COUNT(*)::int FROM "Product"
UNION ALL SELECT 'Warehouse', COUNT(*)::int FROM "Warehouse"
UNION ALL SELECT 'Partner', COUNT(*)::int FROM "Partner"
UNION ALL SELECT 'B2BOrder', COUNT(*)::int FROM "B2BOrder"
UNION ALL SELECT 'PosSale', COUNT(*)::int FROM "PosSale"
UNION ALL SELECT 'Module (saqlangan)', COUNT(*)::int FROM "Module"
UNION ALL SELECT 'Feature (saqlangan)', COUNT(*)::int FROM "Feature";

-- Natija 0 bo'lsa, alohida qator sifatida ishga tushiring:
COMMIT;

-- Bekor qilish:
-- ROLLBACK;
