# Amalga oshirish holati (§32)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 32. Amalga oshirish holati (2026-05-20)

Quyidagi qismlar kod bazasida mavjud. Ushbu bo‘lim amaliy holat bilan sinxronlashtiriladi ([CHANGELOG](./CHANGELOG.md)).

### 32.1 Backend (NestJS + Prisma)

| Modul | Papka | Holat |
|-------|--------|--------|
| Core ERP | auth, companies, products, warehouses, partners, b2b-orders, … | ✅ |
| POS | `modules/pos/` | ✅ chek, CASH/CREDIT checkout, mijoz |
| Chakana mijozlar | `modules/retail-customers/` | ✅ |
| Mijozlar qarzi | `modules/retail-receivables/` | ✅ |
| POS hisoboti | `modules/reports/pos-reports.service.ts` | ✅ |
| Field | `modules/field/` | ✅ |
| Xavfsizlik | JwtAuthGuard, PermissionsGuard, audit | ✅ kengaytirilgan |

- **Ombor scope:** `WarehouseScopeService`, `CompanyUser.warehouseId`, POS scope.
- **Kompaniya sozlamasi:** `Company.posCreditEnabled`.

### 32.2 Ma’lumotlar bazasi (migratsiyalar)

| Migratsiya | Mazmun |
|------------|--------|
| `20260512214500_add_pos_sale_tables` | PosSale, PosSaleItem, PosPayment |
| `20260512230000_add_company_user_warehouse` | CompanyUser.warehouseId |
| `20260520120000_stock_balance_company_variant_index` | StockBalance indeks |
| `20260521120000_pos_retail_customers` | RetailCustomer, RetailReceivable, PosSale mijoz maydonlari |

**Supabase:** `DATABASE_URL` (pooler :6543, `?pgbouncer=true`), `DIRECT_URL` (pooler :5432) — `prisma migrate deploy`.

### 32.3 Frontend (Next.js)

- Kassa: `app/pos/page.tsx` + `features/pos/PosCustomerStrip.tsx`
- Chakana mijozlar / qarz / POS hisobot: `app/dashboard/retail-*`, `app/dashboard/reports/pos`
- **Modul gate:** `lib/feature-modules.ts`, `hooks/use-session.ts`, `lib/session-cache.ts`, `components/ModuleGate.tsx`
- **UI:** Sonner toast, `ConfirmDialog` (alert/confirm o‘rniga)
- **Auth:** httpOnly cookie, `withCredentials: true` (`lib/api.ts`)

### 32.4 Xavfsizlik va audit (XATOLAR.MD — asosiy tuzatishlar)

- System endpointlar productionda blok; JWT cookie; CORS aniq origin + `CORS_ALLOW_VERCEL_PREVIEW`
- Dispatch `productVariantId`; stock adjust yo‘nalishi; goods-receipt partial debt; modul sidebar `all` vs `any` mantiq
- Batafsil ro‘yxat: `XATOLAR.MD`

### 32.5 Hali reja (keyingi bosqich)

- POS: narx override, PIN, smena, printer, karta gateway
- `features/pos/*` to‘liq komponentlarga bo‘lish
- POS hisobotini dashboard va reports sahifasiga chuqur integratsiya

---

