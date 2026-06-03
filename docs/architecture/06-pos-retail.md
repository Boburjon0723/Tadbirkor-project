# POS va chakana (§30–31)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 30. POS moduli (kassa)

### 30.1 Maqsad

Kompaniya ichidagi chakana sotuv: mahsulot tanlash, savat, mijoz, naqd yoki nasiya, ombordan avtomatik chiqim. B2B oqimdan alohida; bir xil mahsulot katalogi va `StockMovement` qoidalaridan foydalanadi.

**Hisobot manbai:** chakana savdo summalari faqat `PosSale` / `PosSaleItem` dan olinadi (`GET /reports/pos/*`). Umumiy `StockMovement OUT` (B2B, qo‘lda chiqim) POS hisobotiga aralashtirilmaydi.

### 30.2 Asosiy entity’lar

**PosSale**
- id, company_id, warehouse_id, sale_number
- subtotal, discount_amount, total_amount, currency
- status (DRAFT, COMPLETED, VOIDED)
- cash_received, cash_change (faqat CASH checkout)
- retail_customer_id (ixtiyoriy), customer_name_snapshot, customer_phone_snapshot
- cashier_id, completed_at, voided_at, voided_by_id, void_reason

**PosSaleItem**
- quantity, unit_price, line_total
- list_price (variant sale_price snapshot — kelajakdagi narx audit uchun)
- product_name_snapshot, sku_snapshot, barcode_snapshot

**PosPayment**
- method: `CASH` | `CREDIT` (karta gateway keyingi bosqich)
- amount, reference

**RetailCustomer** (B2B `Partner` dan alohida)
- company_id, name, phone?, notes?, is_guest

**RetailReceivable** (B2B `DebtEntry` dan alohida)
- retail_customer_id, pos_sale_id (unique), amount, remaining_amount, status (OPEN, PARTIAL, PAID)
- RetailReceivablePayment — qisman to‘lovlar

**Company**
- pos_credit_enabled — nasiya (CREDIT) yoqish/o‘chirish

### 30.3 Biznes qoidalari

- Smenasiz: har chek mustaqil.
- **Mehmon:** retail_customer_id null, ixtiyoriy ism snapshot (chekda).
- **Nasiya (CREDIT):** `pos_credit_enabled = true` va mijoz majburiy (retail_customer_id yoki quick-add).
- Chegirma: umumiy `discount_amount`; qator narxi `unit_price` (keyin: override + PIN).
- Checkout: `StockMovement` OUT, `source_type = POS_SALE`; CREDIT da `RetailReceivable` yaratiladi.
- VOID: stock IN (`POS_VOID`).

### 30.4 API (backend)

**POS** (`apps/api/src/modules/pos/`)
- GET /pos/quick-search, GET /pos/summary/today
- POST /pos/sales (body: items, retailCustomerId?, customerName?, customerPhone?)
- PATCH /pos/sales/:id, POST /pos/sales/:id/checkout (method: CASH|CREDIT)
- POST /pos/sales/:id/void, DELETE /pos/sales/:id

**Chakana mijozlar** (`retail-customers/`) — `assertModuleEnabled(POS)`
- GET /retail-customers, GET /retail-customers/search?q=
- POST /retail-customers, PATCH /retail-customers/:id

**Mijozlar qarzi** (`retail-receivables/`) — POS + pos_credit_enabled
- GET /retail-receivables, POST /retail-receivables/:id/payments

**Hisobot**
- GET /reports/pos/summary, GET /reports/pos/top-products

**Sozlama**
- GET /companies/pos-settings → `{ posCreditEnabled }`
- PATCH /companies/me → posCreditEnabled

Ruxsatlar: `pos.view`, `pos.create`, `pos.void`.

### 30.5 Frontend

| Yo‘l | Vazifa |
|------|--------|
| `/pos` | Kassa + `PosCustomerStrip` + naqd/nasiya |
| `/dashboard/pos` | Cheklar tarixi |
| `/dashboard/retail-customers` | Mijozlar ro‘yxati |
| `/dashboard/retail-receivables` | Nasiya / to‘lov qabul |
| `/dashboard/reports/pos` | POS hisoboti |

**Modul:** barchasi `moduleKeys: ['POS']`. Nasiya UI faqat `posCreditEnabled`.

**Komponentlar:** `apps/web/src/features/pos/PosCustomerStrip.tsx` (kassa); to‘liq `features/pos/*` refactor — reja.

**Batafsil reja:** `IMPLEMENTATION-POS-RETAIL.md`.

---

## 31. Ombor scope va ko‘p nuqtali savdo

### 31.1 Kontsept

Bitta kompaniya (mijoz) — bir nechta ombor (do‘kon nuqtasi). Har bir nuqta uchun alohida ombor yaratiladi; mahsulot shu omborga kirim/chiqim bilan yuritiladi. Alohida `Store` entity hozircha yo‘q: **ombor = do‘kon nuqtasi**.

### 31.2 Rol + ombor biriktirish

| Rol | Ombor scope |
|-----|-------------|
| OWNER, MANAGER, ACCOUNTANT | barcha omborlar |
| SALES, WAREHOUSE | bitta majburiy `warehouse_id` |

- Bir omborga bir nechta SALES/WAREHOUSE biriktirilishi mumkin.
- Bir foydalanuvchi hozircha bitta omborga bog‘lanadi (`CompanyUser.warehouse_id`).

### 31.3 Backend qatlamlari

- **Domain:** `role-assignment.policy` — qaysi rolga ombor kerak.
- **Application:** `WarehouseScopeService` — `getForUser`, `isAllowed`.
- **API:** invite va a’zo rolini yangilashda `warehouse_id` validatsiyasi; `GET /auth/me` va `GET /users/me/warehouse-scope` scope qaytaradi.
- **POS:** `POST /pos/sales` da `warehouse_id` foydalanuvchi scope’iga mos bo‘lishi shart (aks holda 403).

### 31.4 Kengayish (keyingi bosqichlar)

- `CompanyUserWarehouseAccess` — bir xodimga bir nechta ombor.
- `Store` entity — `Warehouse` bilan 1:1 yoki alohida nuqta modeli.
- POS terminal kodi, PIN, smena (shift), X-Z hisobot.

Mikroservis hozircha shart emas: **modular monolith** ichida modul chegaralari va markazlashgan scope xizmati yetarli.

---

