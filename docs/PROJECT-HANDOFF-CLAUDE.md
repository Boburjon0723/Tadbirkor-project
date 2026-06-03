# Tadbirkor (Axis ERP) — loyiha handoff (Claude uchun)

> **Maqsad:** Shu vaqtgacha qilingan o‘zgarishlar, arxitektura, deploy va ochiq masalalar — bitta hujjat.  
> **Sana:** 2026-05-29  
> **Loyiha papkasi:** `Tadbirkor` (monorepo)

---

## 1. Loyiha qisqacha

| Qism | Texnologiya | Deploy |
|------|-------------|--------|
| API | NestJS, Prisma, PostgreSQL, Redis, BullMQ, Socket.io | **Railway** (`apps/api`) |
| Web | Next.js 14, React, TanStack Query, Tailwind | **Vercel** (`axis-erp.uz`) |
| Mobil | Expo / React Native | alohida |
| DB | Supabase PostgreSQL | pooler :6543 (app), :5432 (migrate) |

**Domenlar:** `https://www.axis-erp.uz`, `https://axis-erp.uz`  
**API (tashqi):** `https://tadbirkor-backend-production.up.railway.app`  
**Web → API:** `/api/*` proxy (`apps/web/src/app/api/[[...path]]/route.ts`, `API_PROXY_TARGET`)

**Asosiy modullar:** kompaniya/onboarding, mahsulotlar/ombor, B2B buyurtma, qabul/jo‘natma, qarz, POS (chakana), hamkor daftari, xarajatlar, bildirishnomalar, platforma admin.

**Arxitektura indeks:** `arxetektura.md` → `docs/architecture/README.md`

---

## 2. Autentifikatsiya (muhim)

- **Ikki kanal:** httpOnly cookie + `sessionStorage` Bearer (`axis_access_token`) — mobil Safari uchun.
- **Fayllar:** `apps/api/src/common/auth-cookie.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/auth-token.ts`
- **CORS (Railway):** `CORS_ORIGINS` slashsiz:  
  `http://localhost:3000,https://tadbirkor-frontend.vercel.app,https://www.axis-erp.uz,https://axis-erp.uz`
- **Vercel:** `API_PROXY_TARGET` = Railway API origin (slashsiz, `/api` siz)

### Platforma admin (haqiqiy admin panel)

| URL | Vazifa |
|-----|--------|
| `/dashboard/platform-admin` | Kompaniyalar, obuna/sinov boshqaruvi |
| `/admin/login` | Oddiy ERP login → platform admin tekshiruvi |
| `/admin` | → redirect `/dashboard/platform-admin` |

**Railway API env (kamida bittasi + PIN tavsiya):**

```env
PLATFORM_ADMIN_EMAILS=admin@example.com
PLATFORM_ADMIN_LOGINS=your-login
PLATFORM_ADMIN_PIN=your-secret-pin
```

**Alias (oldingi nomlar):** `ADMIN_EMAIL`, `ADMIN_LOGIN`, `ADMIN_PASSWORD` (= PIN, ERP paroli emas)

**Kod:** `apps/api/src/common/platform-admin.util.ts`, `apps/api/src/modules/platform/`, `apps/web/src/app/dashboard/platform-admin/`, `PlatformAdminPinGate.tsx`

**Eski demo olib tashlandi:** `admin` / `admin123` va `admin_token` cookie endi ishlatilmaydi.

**`/auth/me` javobida:** `isPlatformAdmin: boolean` — sidebar’da «Admin panel» linki.

---

## 3. O‘zgarishlar jurnali (mavzular bo‘yicha)

### 3.1 Excel → ombor (kirim import) — asosiy muammo hal qilindi

**Muammo:** Exceldan mahsulot kiritilganda ombor/zaxira yangilanmasdi; preview `skip` qatorlari importga tushmasdi; `stockPolicy` noto‘g‘ri.

**Tuzatishlar (API):**

- Default `stockPolicy: 'apply_all'` (preview, confirm, DTO).
- Yangi mahsulot yaratishda zaxira `shouldApplyStock()` orqali, faqat preview `stockAction` ga bog‘lanmasdan.
- **ARCHIVED** SKU/barcode preview’da ko‘rinadi; import qayta faollashtiradi + zaxira yangilanadi.
- Kategoriya bo‘lmasa default `Umumiy`.
- Valyuta ustuni: raqam tushsa **jim UZS qilmaydi** — `parseImportCurrencyCell` raqam uchun `''` qaytaradi (`product-import-excel.util.ts` ~180).
- Kirim ustuni aliaslari: `kirim`, `miqdor`, `qoldiq`, va hokazo.
- Preview: `confirmable`, `stockApplyCount`, `defaultImportMode: 'add'`, `?importMode=` query.
- Test: `product-import-excel.util.spec.ts` (ExcelJS import tuzatilgan).

**Asosiy fayllar:**

- `apps/api/src/modules/products/product-import.service.ts`
- `apps/api/src/modules/products/product-import-excel.util.ts`
- `apps/api/src/modules/products/products.controller.ts`
- `apps/web/src/features/inventory/components/ImportProductModal.tsx`

### 3.2 Mahsulot saqlash oqimi (atomik)

**Hujjat:** `docs/architecture/17-product-save-entry-flow.md`

- `PATCH /products/:id` — `stockAdjustments[]` **bitta tranzaksiya**da (`products.service.ts`, DTO).
- `ProductModal` — alohida `/stock/adjustments` saqlashda emas, PATCH ichida.
- Tahrir: `GET /products/:id?warehouseId=` yuklanmaguncha saqlash blok; loading overlay.
- Yangi mahsulot: kategoriya mavjud bo‘lsa default tanlash.
- **Tezkor kirim:** `QuickStockModal.tsx` (inventar) — Excel asosiy yo‘l deb qoldirilgan.

### 3.3 Onboarding — sinov muddati matni

- **7 kun** (API `TRIAL_DAYS`, default 7) — «30 kunlik bepul» olib tashlandi.
- `apps/web/src/lib/trial.ts` — yagona manba.
- Yangilangan: `onboarding/company`, `review`, `loading`, `success`.

### 3.4 Navigatsiya tezligi (web)

- Sidebar `prefetch={false}` olib tashlandi.
- `apps/web/src/lib/dashboard-prefetch.ts` — route + ma’lumot prefetch.
- `DashboardSidebarNav`, mobile nav, layout mount prefetch.
- Session: uzoqroq `staleTime`, kamroq mount refetch.
- Inventar detail: `Link` + prefetch (`router.push` o‘rniga).

### 3.5 Mobil Excel import

- `mobile/src/components/warehouse/WarehouseImportModal.tsx` — web bilan yaqin:
  - `hasImportableStock` — `skip` + faylda qoldiq > 0 bo‘lsa ham confirm.
  - `stockPolicy: 'apply_all'`.

### 3.6 Ma’lumotlar bazasini tozalash

- **To‘liq wipe:** `scripts/sql/wipe-all-companies-and-users.sql` (TRUNCATE, `Module`/`Feature` saqlanadi).
- **CLI:** `cd apps/api` → `npm run db:wipe-all` (yo‘l: `../../scripts/sql/...`, Git Bash da `/` ishlating).
- **Bitta kompaniya katalog:** `scripts/sql/clear-company-warehouse-products.sql` — `v_company_id` UUID kerak.
- Wipe bajarilgach: yangi ro‘yxatdan o‘tish, API/web restart, brauzer session tozalash.

### 3.7 Platforma admin (2026-05-29 sessiya)

- `/admin` demo → haqiqiy auth + platform API.
- Railway `ADMIN_*` → `PLATFORM_ADMIN_*` alias.
- Sidebar: platform admin uchun «Admin panel».
- Hujjat: `docs/architecture/10-deploy-auth.md` (admin bo‘limi).

### 3.8 Oldingi (CHANGELOG dan — qisqa)

| Sana | Mavzu |
|------|--------|
| 2026-05-24 | axis-erp.uz login: Bearer + `/api` proxy |
| 2026-05-25 | Excel split ustunlar, `Decimal(15,4)` zaxira, inventar `view=catalog`, realtime |
| 2026-05-25 | API refaktor: import, goods-receipt, B2B, hisobotlar alohida servislar |
| 2026-05-25 | Sahifalash, og‘ir so‘rovlar sana/limit |
| 2026-05-20 | POS chakana, retail mijozlar, qarz |
| 2026-05 | Xavfsizlik audit (`XATOLAR.MD`), modul sidebar, session cache |

To‘liq jadval: `docs/architecture/CHANGELOG.md`

---

## 4. Muhim fayllar xaritasi

```
apps/api/
  src/modules/products/     — mahsulot, import, excel util
  src/modules/platform/   — platforma admin API
  src/modules/auth/         — login, getMe (+ isPlatformAdmin)
  src/common/platform-admin.util.ts
  prisma/schema.prisma
  .env.example

apps/web/
  src/app/dashboard/platform-admin/
  src/app/admin/login/          — admin kirish (JWT)
  src/features/inventory/       — ImportProductModal, ProductModal, jadval
  src/lib/api.ts, dashboard-prefetch.ts, trial.ts
  src/app/api/[[...path]]/route.ts  — Railway proxy

mobile/
  src/components/warehouse/WarehouseImportModal.tsx

scripts/sql/
  wipe-all-companies-and-users.sql
  clear-company-warehouse-products.sql

docs/architecture/
  10-deploy-auth.md
  15-notifications-audit-and-plan.md
  17-product-save-entry-flow.md
  CHANGELOG.md
```

---

## 5. Environment (Railway API — checklist)

| O‘zgaruvchi | Majburiy | Izoh |
|-------------|----------|------|
| `DATABASE_URL` | Ha | :6543, `pgbouncer=true` |
| `DIRECT_URL` | Migrate uchun | :5432 |
| `JWT_SECRET` | Ha | |
| `CORS_ORIGINS` | Ha | slashsiz |
| `REDIS_URL` | Ha | BullMQ, cache |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Rasm uchun | |
| `PLATFORM_ADMIN_*` yoki `ADMIN_*` | Admin uchun | |
| `TRIAL_DAYS` | Ixtiyoriy | default 7 |
| `B2B_ORDER_MAX_LINE_ITEMS` | Ixtiyoriy | web `order-limits.ts` bilan mos |

**Vercel:** `API_PROXY_TARGET`, `NEXT_PUBLIC_API_URL` = `same-origin` yoki bo‘sh.

**npm script (API):** `db:wipe-all` — `package.json`

---

## 6. Tekshiruv buyruqlari

```bash
# API
cd apps/api
npx tsc --noEmit
npx ts-node src/modules/products/product-import-excel.util.spec.ts

# Web
cd apps/web
npx tsc --noEmit

# Mobil
cd mobile
npx tsc --noEmit
```

---

## 7. Ochiq / reja (keyingi ishlar)

| Mavzu | Hujjat / holat |
|-------|----------------|
| Bildirishnomalar (Telegram, audit) | `docs/architecture/15-notifications-audit-and-plan.md` |
| Mahsulot oqimi bug tahlili | `docs/architecture/16-product-flow-bug-analysis.md` |
| POS: printer, smena, karta | `07-implementation-status.md` §32.5 |
| Platform admin UI | asosiy funksiya bor; `/admin` eski placeholder UI olib tashlangan/redirect |

---

## 8. Claude uchun ish qoidalari

1. **Minimal diff** — faqat so‘ralgan muammo; ERP production.
2. **Excel import** — `stockPolicy`, `skip` + `with_stock`, API va web/mobile paritet.
3. **Zaxira** — `StockBalance` faqat `ProductVariant` + `Warehouse`; harakat `StockMovement`.
4. **Deploy** — API o‘zgarishi → Railway redeploy; web → Vercel; migratsiya alohida `prisma migrate deploy`.
5. **Admin** — faqat `PLATFORM_ADMIN_*` / JWT; hardcoded parol qo‘ymang.
6. **Windows terminal** — PowerShell: `;` ishlating, `&&` emas; Git Bash: yo‘lda `/` ishlating.
7. **Maxfiy ma’lumot** — `.env`, DB parollarni hujjatga yozmang.

---

## 9. Foydalanuvchi konteksti (qisqa)

- Loyiha **sotiladi / yangilanadi** (SaaS modeli) — bitta DB, ko‘p `Company`.
- Test kompaniya ma’lumotlari xato keltirgan — **bazani wipe** qilish mumkin (`wipe-all-companies-and-users.sql`).
- Asosiy og‘riq nuqtasi: **Excel kirim → ombor** va **mahsulot saqlash atomikligi**.
- Til: o‘zbekcha UI/matn; kod inglizcha.

---

## 10. Bog‘liq hujjatlar

| Fayl | Mazmun |
|------|--------|
| `docs/architecture/CHANGELOG.md` | Qisqa sana jadvali |
| `docs/architecture/10-deploy-auth.md` | Deploy, CORS, admin |
| `docs/architecture/17-product-save-entry-flow.md` | Mahsulot/zaxira kanoni |
| `docs/RAILWAY-SUPABASE-DATABASE.md` | DB ulanish |
| `docs/RAILWAY-REDIS.md` | Redis |
| `XATOLAR.MD` | Xavfsizlik audit |

---

*Ushbu faylni yangilash: har katta feature/fix dan keyin §3 ga band qo‘shing yoki `CHANGELOG.md` bilan sinxronlang.*
