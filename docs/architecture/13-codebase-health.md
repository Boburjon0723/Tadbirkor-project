# Kod bazasi holati va optimallashtirish rejasi

> **Oxirgi ko‘rik:** 2026-05-25  
> Production ishlayapti; tuzatishlar **asta refaktor** — big-bang emas.

---

## Umumiy baho

| Yo‘nalish | Holat | Izoh |
|----------|--------|------|
| Arxitektura modeli | ✅ Yaxshi | Modular monolith (Nest modullar + Prisma) |
| Domain ajratish (API) | ✅ Yaxshi | 28 modul — har biznes bo‘limi alohida papka |
| Frontend yo‘nalish | ⚠️ O‘rtacha | `features/` bor, lekin ko‘p mantiq hali `app/` va `components/` da |
| Fayl hajmi (god object) | ⚠️ Qizil zona | 4 ta API service 1200+ qator; 3 ta web sahifa 600+ qator |
| Testlar | ⚠️ Zaif | API: 2 ta `.spec.ts`; web: deyarli yo‘q |
| DB schema | ✅ Yaxshi | 43 model, migratsiyalar tartibli |
| Deploy barqarorligi | ✅ | Railway + Vercel ishlayapti |

**Xulosa:** MVP va production uchun **yetarli**. Texnik qarz asosan **katta fayllar** va **test yo‘qligi** da to‘planadi — funksional buzilish xavfi past, maintain qiyinlashishi mumkin.

---

## API (`apps/api`) — yaxshi tomonlar

- Har modul: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`
- `StockService` — barcha qoldiq `StockMovement` orqali (to‘g‘ri qoida)
- `common/units/product-unit.util.ts` — birlik validatsiyasi markazlashtirilgan
- `product-import-excel.util.ts` — Excel parse alohida (to‘g‘ri yo‘nalish)
- `inventory.gateway.ts` — realtime eventlar
- `prisma/transaction-options.ts` — tranzaksiya sozlamalari

### Eng katta fayllar (refaktor navbati)

| Fayl | ~Qator | Ichidagi vazifalar |
|------|--------|-------------------|
| `products.service.ts` | **~766** | CRUD, katalog, barcode, audit |
| `product-import.service.ts` | **~1525** | Excel preview/confirm, BullMQ job, staging |
| `goods-receipts.service.ts` | **~580** | Ro‘yxat, findOne, mapping enrich |
| `goods-receipt-accept.service.ts` | **~1150** | accept, partialAccept, reject, ombor IN |
| `goods-receipt-export.service.ts` | **~160** | Excel eksport |
| `b2b-orders.service.ts` | **1351** | Buyurtma, qatorlar, pagination, workflow |
| `reports.service.ts` | **~740** | Hisobotlar, analytics, qarz akt ma'lumot |
| `report-excel.service.ts` | **~614** | Excel eksport + import shablon |
| `b2b-orders.service.ts` | **~752** | Katalog, CRUD, ro'yxat |
| `b2b-order-workflow.service.ts` | **~655** | send/accept/reject, mapping |
| `b2b-order-export.service.ts` | **~82** | Buyurtma Excel |
| `pos.service.ts` | **1163** | Checkout, savat, mijoz, stock OUT |

**Bajarildi (2026-05-25) — `products` import ajratildi:**

```text
products.service.ts          # CRUD, findAll, findOne, katalog summary
product-import.service.ts    # preview, confirm, job, staging, BullMQ
product-catalog.service.ts   # (ixtiyoriy — hali bitta service ichida)
```

**Tavsifa — `reports.service.ts`:** Excel import shablonini `products` yoki `reports/excel/` ga yaqinlashtirish; PDF hisobotlar alohida `reports/pdf/`.

---

## Web (`apps/web`) — yaxshi tomonlar

- `inventory/` → `features/inventory/*` (namuna bo‘yicha yaxshi ajratilgan)
- `product-modal/` → `features/product-modal/` + `components/ProductModal.tsx` re-export
- `hooks/` + `services/` — API va React Query ajratilgan
- `lib/product-units.ts`, `product-import-guide.ts` — domen yordamchilari

### Muammo: «qalin» sahifalar

| Fayl | ~Qator | Muammo |
|------|--------|--------|
| `debts/page.tsx` | **1325** | UI + mantiq + socket bir joyda |
| `CreateOrderDesktopModal.tsx` | **923** | Buyurtma formasi monolit |
| `ImportProductModal.tsx` | **632** | `components/` da, `features/import/` ga ko‘chirish mumkin |
| `activity/page.tsx` | **628** | Audit UI |
| `dashboard/page.tsx` | **594** | Dashboard monolit |

**Maqsad:** har `page.tsx` ≤ **150–200** qator; qolgani `features/<domain>/`.

### `components/` vs `features/`

| Hozir | Maqsad |
|-------|--------|
| 21 ta fayl `components/` root da | Faqat umumiy: `ModuleGate`, `ConfirmDialog`, layout |
| 8 ta `features/` papka | Har domain UI shu yerda |
| `ImportProductModal`, `AcceptReceiptModal`, … | Astida-sekin `features/` ga |

---

## Ma’lumotlar bazasi

- **43** Prisma model — ERP uchun mantiqiy
- Stock: `Decimal(15,4)` — o‘nlik qoldiq (2026-05-25 migratsiya)
- Indekslar: `StockBalance(companyId, productVariantId)` va boshqalar

**Ehtiyot:** productionda `prisma migrate deploy` yangi migratsiyalar bilan sinxron bo‘lishi kerak.

---

## Testlar va sifat

| Joy | Holat |
|-----|--------|
| `product-import-excel.util.spec.ts` | ✅ Excel parse |
| `warehouse-catalog.util.spec.ts` | ✅ |
| E2E / integration | ❌ |
| Web unit | ❌ |

**Minimal maqsad:** har `*.util.ts` uchun spec; kritik oqimlar (import, stock, checkout) uchun 1 integration test.

---

## Sahifalash (2026-05-25) — bajarildi

| Endpoint | Default `limit` | Javob shakli |
|----------|-----------------|--------------|
| `GET /goods-receipts` | 30 (max 100) | `{ items, page, limit, total, hasMore, summary }` |
| `GET /dispatches` | 30 (max 100) | `{ items, page, limit, total, hasMore }` |
| `GET /debts/partner-groups` | 40 (max 80) | `{ items, summary, … }` — qarzlar UI |
| `GET /debts/entries` | 50 (max 100) | `{ items, page, limit, total, hasMore }` |
| `GET /debts/entries/summary` | — | KPI (`receivable`, `payable`, `net`) |

Web: `receipts/page.tsx`, `debts/page.tsx` yangi shaklga moslashtirildi.

### Priority 2 (2026-05-25) — default sahifalash

| Endpoint | Default | Legacy to‘liq ro‘yxat |
|----------|---------|------------------------|
| `GET /products` | `limit=50`, max 200 | `?all=true` yoki `?limit=all` |
| `GET /b2b-orders`, `GET /incoming-orders` | `limit=30`, max 100 | `?all=true` |

Javob (default): `{ items, page, limit, total, hasMore }` (+ products `view=catalog` da `summary`).

### Og‘ir endpointlar himoyasi (2026-05-25)

| So‘rov | Himoya |
|--------|--------|
| `GET /reports/summary*` | Default 90 kun, max 366 kun; >25k harakat → 400 |
| `POST /products/import/preview` | Max 2500 qator |
| `POST /products/import/confirm` | Max 5000 qator (navbat/sync) |
| `POST /goods-receipts/.../accept` | Max 800 qator (chunk 35 saqlanadi) |

Env: `REPORT_*`, `IMPORT_*`, `RECEIPT_MAX_ACCEPT_LINES` — `apps/api/.env.example`

---

## Dublikat / texnik qarz (kichik)

- `product-units` — API `common/units/` va web `lib/` (keyin `packages/shared` mumkin)
- `@deprecated` belgilar bor — tozalash navbatda
- `reports` + `products` — Excel mantiqi ikkala tomonda tegishli

---

## Optimallashtirish bosqichlari (tavsiya)

| Navbat | Ish | Xavf | ROI |
|--------|-----|------|-----|
| **1** | `products.service` → import alohida service | Past | Yuqori |
| **2** | `debts/page.tsx` → `features/debts/` | Past | Yuqori |
| **3** | `ImportProductModal` → `features/inventory/` | Past | O‘rta |
| **4** | `goods-receipts.service` bo‘lish (qabul / mapping) | O‘rta | O‘rta |
| **5** | pnpm workspaces + `packages/shared` (unit, types) | O‘rta | Uzoq muddat |
| **6** | Testlar: import + stock + pos checkout | Past | Yuqori (regressiya) |

**Qilmaslik (hozir):** microservices, to‘liq FSD migratsiya, barcha sahifalarni bir vaqtda qayta yozish.

---

## Kod xaritalari (mavjud)

| Modul | Hujjat |
|-------|--------|
| Ombor / inventar | [12-code-maps-warehouse.md](./12-code-maps-warehouse.md) |
| Qolgan modullar | Reja — `12-code-maps-*.md` qo‘shish |

---

## Yangilash qoidasi

Katta refaktor qilinganda:

1. Bir PR = bir service yoki bir sahifa bo‘linishi
2. `CHANGELOG.md` + ushbu faylda «bajarildi» belgisi
3. Deploydan oldin `npm run build` (api + web)
