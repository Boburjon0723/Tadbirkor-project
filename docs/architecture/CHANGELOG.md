# O‘zgarishlar jurnali (§38)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 38. O‘zgarishlar jurnali (qisqa)

| Sana | Mavzu | Hujjat / kod |
|------|--------|----------------|
| 2026-05-29 | Excel kirim: confirmable/stockApplyCount, default `add`, kirim ustuni, preview importMode | `product-import.service`, `ImportProductModal` |
| 2026-05-29 | Mahsulot saqlash oqimi: PATCH+stock bir TX, tahrir yuklash, kanonik hujjat | [17-product-save-entry-flow](./17-product-save-entry-flow.md), `products.service`, `ProductModal` |
| 2026-05 | Xavfsizlik audit tuzatishlari | `XATOLAR.MD` |
| 2026-05 | Modul sidebar + session cache | `layout.tsx`, `session-cache.ts` |
| 2026-05 | Auth cookie + CORS | `main.ts`, `auth-cookie.ts` |
| 2026-05-20 | Chakana mijozlar, nasiya, POS hisobot | `IMPLEMENTATION-POS-RETAIL.md`, §30, §34 |
| 2026-05-23 | Katta yuk qabul (chunk, mapping prefetch) | §16.6, `goods-receipts.service.ts` |
| 2026-05-23 | Buyurtma limit + hamkor guruh UI | §37, `b2b-orders` |
| 2026-05-24 | Production: axis-erp.uz login | §35 — Bearer + `/api` proxy |
| 2026-05-24 | Akt sverka PDF pdfmake | `partner-balance-pdf.util.ts` |
| 2026-05-24 | Qisman qabul chunk + invoice/receipt PDF pdfmake | §16.6, `partialAccept`, `invoice-pdf.util.ts` |
| 2026-05-24 | Buyurtma limit 1000 (web env) | `order-limits.ts`, `B2B_ORDER_MAX_LINE_ITEMS` |
| 2026-05-25 | Excel import: Birlik (J), split ustunlar, vergul/nuqta qoldiq | §10.7, `product-import-excel.util.ts` |
| 2026-05-25 | O‘nlik qoldiq `Decimal(15,4)`; dona = butun son | migratsiya `20260523120000_stock_quantity_decimal`, `product-unit.util.ts` |
| 2026-05-25 | Inventar: `view=catalog`, realtime `inventory:changed` | `products.service.ts`, `use-inventory-realtime.ts` |
| 2026-05-25 | Qarz FIFO ommaviy to‘lov | §17.6, `debts.service.ts` |
| 2026-05-25 | Mahsulot: `imageUrl: null` (Vercel build), barcode tahrir | `ProductModal`, `products.service.ts` |
| 2026-05-25 | Production deploy tekshiruvi | Railway (`apps/api`), Vercel (`apps/web`) |
| 2026-05-25 | Arxitektura hujjatlari bo‘linishi | `docs/architecture/*`, `arxetektura.md` → indeks |
| 2026-05-25 | API refaktor: mahsulot import alohida servis | `product-import.service.ts`, `product-import.types.ts` |
| 2026-05-25 | API refaktor: yuk qabul 3 servisga bo‘linildi | `goods-receipt-accept/export.service.ts`, `goods-receipt.shared.ts` |
| 2026-05-25 | API refaktor: B2B buyurtma + hisobotlar bo‘linishi | `b2b-order-workflow/export`, `report-excel.service.ts` |
| 2026-05-25 | Og‘ir ro‘yxatlar: sahifalash (API + web) | `list-pagination.util.ts`, `goods-receipts`, `dispatches`, `debts/partner-groups` |
| 2026-05-25 | Default sahifalash: products, b2b-orders | `wantsFullList`, `?all=true` legacy |
| 2026-05-25 | Og‘ir endpointlar: sana limit, import/qabul qator limiti | `report-date-range.util`, `import-limits.util` |
| 2026-05-25 | POS↔ombor realtime: katalog cache tozalash + tezroq invalidate | `pos-catalog-cache.util`, `stock.service`, `use-pos-realtime` |

---
