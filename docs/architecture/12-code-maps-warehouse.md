# Kod xaritalari — ombor (§39)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 39. Ombor moduli — kod xaritasi (2026-05-25)

```text
apps/api/
├── prisma/migrations/20260523120000_stock_quantity_decimal/
├── src/common/units/product-unit.util.ts      # dona/kg/l/m, validateStockQuantity
├── src/modules/products/
│   ├── product-import-excel.util.ts           # Excel parse, ustunlar, parseExcelDecimalCell
│   └── products.service.ts                      # import preview/confirm, catalog view
├── src/modules/reports/reports.service.ts       # shablon + export products-import-format
└── src/modules/warehouses/
    ├── stock.service.ts                         # harakatlar + birlik validatsiyasi
    └── inventory.gateway.ts                     # inventory:changed, debts:changed

apps/web/
├── src/lib/product-units.ts                     # formatStockQuantity, PRODUCT_UNIT_OPTIONS
├── src/lib/product-import-guide.ts              # Import qo‘llanmasi (UI)
├── src/features/inventory/                      # jadval, realtime
├── src/features/product-modal/                  # birlik, zaxira input
└── src/components/ImportProductModal.tsx
```

**Deploy (production):**

| Servis | Platform | Muhim sozlama |
|--------|----------|----------------|
| API | Railway | Root Directory: **`apps/api`**; `DATABASE_URL` port **6543** (`?pgbouncer=true`) |
| Web | Vercel | `API_PROXY_TARGET`; build: `CreateProductDto.imageUrl` — `string \| null` |

**Migratsiya (production DB):** deploydan keyin bir marta `npx prisma migrate deploy` (Railway shell yoki CI).

**Keyingi bosqich (reja):** skaner bilan tez qabul; POS da birlik bo‘yicha o‘nlik miqdor.

---
