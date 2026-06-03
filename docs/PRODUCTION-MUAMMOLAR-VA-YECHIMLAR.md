# Production muammolar, sekinlik va ko‘p foydalanuvchi — to‘liq qo‘llanma

> **Maqsad:** `axis-erp.uz` / Railway / Supabase muhitida ko‘rilgan xatolar (503, sekinlik, sessiya, inventarizatsiya), sabablari, tekshiruv tartibi va yechimlar — bitta hujjat.  
> **Bog‘liq:** [10-deploy-auth.md](./architecture/10-deploy-auth.md), [RAILWAY-SUPABASE-DATABASE.md](./RAILWAY-SUPABASE-DATABASE.md), [03-b2b-chain.md](./architecture/03-b2b-chain.md) (P2028 / katta qabul), [OMBOR-B2B-JARAYON-VA-MASLAHATLAR.md](./OMBOR-B2B-JARAYON-VA-MASLAHATLAR.md).

**Oxirgi yangilanish:** 2026-06-03

---

## 1. Qisqa xulosa

| Belgilar | Asosiy sabab (ko‘pincha) |
|----------|---------------------------|
| `POST /api/inventory-counts` → **503** (9–12 s) | Uzoq DB tranzaksiya yoki HTTP timeout; P2028 «bazasi band» |
| `GET /api/inventory-counts` → **200**, POST → **503** | API ishlayapti; muammo faqat og‘ir «Yangi sanash» operatsiyasida |
| Sahifa sekin, ba’zan 503 | Supabase pool (~5 ulanish) + ko‘p parallel so‘rov |
| Login/parol qayta so‘raladi | Sessiya tugadi (401); brauzer autofill — **parol serverda yig‘ilmaydi** |
| 3+ kishi bir vaqtda | Xuddi yuqoridagi cheklovlar **kuchayadi** |

**Muhim:** Ko‘p muammo **frontend xato** emas — **production yuk** (DB pool, og‘ir tranzaksiya, deploy/migratsiya) bilan bog‘liq.

---

## 2. Production arxitektura

```text
Foydalanuvchi (brauzer)
    ↓
https://www.axis-erp.uz          (Vercel — Next.js 14)
    ├── /dashboard, /pos, …
    └── /api/*  →  rewrite/proxy  →  Railway NestJS
                              URL: tadbirkor-backend-production.up.railway.app
                              ├── PostgreSQL (Supabase, pooler :6543)
                              ├── Redis (cache, BullMQ)
                              └── Socket.io (/inventory, /notifications)
```

| Platforma | Vazifa |
|-----------|--------|
| **Vercel** | Web UI, `/api/*` proxy (`next.config.js`, `apps/web/src/app/api/[[...path]]/route.ts`) |
| **Railway** | NestJS API (`apps/api`) |
| **Supabase** | PostgreSQL (transaction pooler) |

**API yo‘llari (inventarizatsiya):**

| Frontend | Backend controller |
|----------|-------------------|
| `GET/POST /api/inventory-counts` | `@Controller('inventory-counts')` — `inventory-count.controller.ts` |
| `GET /api/inventory-counts/:id` | `findOne` |

`inventory-count` (birlikdagi) alohida API **yo‘q** — bu React Query kaliti: `["inventory-count", id]`.

---

## 3. Inventarizatsiya: POST 503 (git push dan keyin)

### 3.1 Belgilar (Railway HTTP log)

| Vaqt | Method | Path | Status | Davomiylik |
|------|--------|------|--------|------------|
| — | GET | `/api/inventory-counts` | **200** | ~2–3 s |
| — | POST | `/api/inventory-counts` | **503** | **9–12 s** |
| — | GET | `/api/inventory-counts/:id` | **200** | ~3 s |

**NestJS log:** servis muvaffaqiyatli start (Telegram, Redis, BullMQ, Supabase Storage) — API **yiqilmagan**.

**Xulosa:** Ro‘yxat ishlaydi; **«+ Yangi sanash»** (`POST`) og‘ir yoki timeout.

### 3.2 Texnik sabab

`InventoryCountService.startCount` (eski versiya) **bitta uzun tranzaksiya**da:

1. `InventoryCount` + barcha qatorlar
2. Har bir `StockBalance` uchun `StockBlock` + `blockedQuantity` yangilash

Omborda ko‘p SKU bo‘lsa:

- Tranzaksiya **10+ soniya**
- Railway/Vercel proxy **~10 s** chegarasi → **503**
- Yoki Prisma **P2028** → filter **503** + `"Ma'lumotlar bazasi band..."`

```text
apps/api/src/common/filters/prisma-exception.filter.ts  →  P2028 → 503
apps/api/src/prisma/database-url.ts                   →  connection_limit=5
```

### 3.3 Kod yechimi (2026-06-03)

`apps/api/src/modules/warehouses/inventory-count.service.ts`:

1. **Qisqa tranzaksiya** — hujjat + `inventoryCountItem.createMany`
2. **Bloklar chunklarda** (35 tadan) — `INVENTORY_BLOCK_CHUNK_SIZE` (`transaction-options.ts`)
3. Xato bo‘lsa — `abortStartedCount` (bekor + blok yechish)
4. `complete` / `cancel` — blok yechish ham chunklarda

**Deploy:** API o‘zgarishi → Railway **push/redeploy**; web alohida Vercel.

### 3.4 Tekshiruv (deploydan keyin)

1. Railway → Deployments → **Success**
2. Shell: `npx prisma migrate deploy` (agar yangi migratsiya push qilingan bo‘lsa)
3. Brauzer: **Network** → POST `inventory-counts` → Response body
4. «Yangi sanash» qayta sinash

**Kerakli migratsiyalar (inventarizatsiya moduli):**

| Migratsiya | Mazmun |
|------------|--------|
| `20260601143000_add_atp_stock_reservation` | `StockBalance.blockedQuantity` |
| `20260602120000_physical_inventory` | `InventoryCount`, `InventoryCountItem`, `StockBlock` |

---

## 4. Boshqa ko‘rinadigan xatolar

### 4.1 `GET /api/health` → 404

`/api/health` endpoint loyihada **yo‘q**. Bu diagnostika xatosi emas; boshqa URL bilan health tekshiring yoki Railway servis holatiga qarang.

### 4.2 Recharts: `width(-1) and height(-1)`

Dashboard grafik konteyneri o‘lchamsiz paydo bo‘lganda (masalan, yashirin tab). **Inventarizatsiya/API ga ta’sir qilmaydi.**

### 4.3 Service Worker (`sw.js`) → 503 «Offline»

PWA offline rejimida ba’zi so‘rovlar **503** qaytarishi mumkin. Yangi deploydan keyin hard refresh (`Ctrl+F5`) yoki SW yangilanishini kutish.

---

## 5. Sekinlik va «ma’lumotlar to‘planishi»

### 5.1 Parol va login — serverda yig‘ilmaydi

| Joy | Nima saqlanadi |
|-----|----------------|
| `sessionStorage` | JWT: `axis_access_token` (`apps/web/src/lib/auth-token.ts`) |
| `localStorage` | `user`, `company` JSON — **parol yo‘q** (`auth.service.ts`) |
| Server DB | Faqat parol **xesh** |

**Login qayta so‘rash:**

- API **401** → interceptor token o‘chiradi, `/` ga yo‘naltiradi (`apps/web/src/lib/api.ts`)
- Brauzer **autofill** — bir nechta login aralashishi mumkin

### 5.2 Bir sahifada ko‘p API so‘rovi

Dashboard yuklanganda tipik parallel so‘rovlar (loglardan):

- `GET /auth/me` (sessiya ichida)
- `GET /companies/features`
- `GET /warehouses`
- `GET /inventory-counts` (ba’zan takror)
- `GET /notifications/unread-count`
- Socket: `/socket.io/` (uzoq ulanish — normal)

**Frontend qo‘shimcha yuk manbalari:**

| Manba | Fayl / mexanizm | Ta’sir |
|-------|-----------------|--------|
| Sessiya | `use-session.ts` — `getMe` + `getFeatures` | Har yangi sessiya |
| Owner qayta fetch | `dashboard/layout.tsx` — `refetchQueries(SESSION_QUERY_KEY)` | Owner uchun **ikkinchi** sessiya so‘rovi |
| Bildirishnomalar | `use-notifications.ts` — `refetchInterval: 30s` (socket yo‘q bo‘lsa) | Doimiy fon yuk |
| Realtime | `use-company-realtime.ts` — `invalidateQueries` to‘lqini | Socket hodisada ko‘p qayta yuklash |
| Settings | `settings/page.tsx` — alohida `authService.getMe()` | `useSession` dan tashqari dublikat |
| Sidebar | `dashboard-prefetch.ts` — marshrut prefetch | Next.js sahifa prefetch (API emas, lekin ochilganda so‘rov) |
| Layout + Dashboard | Ikkalada `useCompanyRealtime` | Bir xil socket listener (singleton socket, lekin invalidate ikki marta bo‘lishi mumkin) |

### 5.3 Ma’lumotlar «to‘planishi» (kesh)

| Qatlam | Tavsif |
|--------|--------|
| React Query | `staleTime` 3–5 daq, `gcTime` 15–30 daq — xotirada eski ma’lumot |
| `localStorage` | Logout to‘liq bo‘lmasa eski `user` qolishi mumkin |
| Bir nechta tab | Har tab = alohida socket + so‘rovlar |
| PWA / SW | Eski bundle cache |

Bu **serverda login/parol to‘planishi** emas.

---

## 6. Ma’lumotlar bazasi bandligi (P2028) va 503

### 6.1 Supabase pool cheklovi

`apps/api/src/prisma/database-url.ts`:

- Transaction pooler: port **6543**, `pgbouncer=true`
- `connection_limit=5` (bitta API instansiyasi uchun)
- Izoh: pool ~15 ulanish; 3 ulanish → P2028 tez-tez

### 6.2 API → 503 mapping

`PrismaExceptionFilter`:

- **P2028** → HTTP **503**, xabar: *«Ma'lumotlar bazasi band. Bir necha soniyadan keyin qayta urinib ko'ring.»*

Boshqa Prisma xatolari odatda **500**.

### 6.3 Og‘ir operatsiyalar (barcha modullar)

| Operatsiya | Xavf |
|------------|------|
| Inventarizatsiya boshlash (`POST inventory-counts`) | Ko‘p qator + blok — **yuqori** |
| Katta qabul (400+ qator) | Chunk qilingan (`goods-receipt-accept.service.ts`, `RECEIPT_ACCEPT_CHUNK_SIZE=35`) |
| Uzoq B2B / dispatch tranzaksiyalari | `timeout` / `maxWait` sozlangan (`transaction-options.ts`) |

---

## 7. Ko‘p foydalanuvchi (3+ bir vaqtda)

### 7.1 Nima oshadi

```text
1 foydalanuvchi  →  ~6–10 parallel API + 1–2 WebSocket
3 foydalanuvchi  →  ~18–30 parallel API + 3 WebSocket
5+ foydalanuvchi →  pool (5) tez to‘ladi → navbat → P2028 / 503
```

| Holat | Kutilish |
|-------|----------|
| 3 kishi faqat ro‘yxat / o‘qish | Odatda yomon emas |
| 3 kishi + biri inventar / katta qabul / kassa | Stress, 503 ehtimoli **yuqori** |
| 5–10 kishi ish vaqti, 1 Railway instansiya | Hozirgi arxitektura uchun **barqaror emas** (reja kerak) |

### 7.2 Nima «3 ta mijoz» emas

Muammo **loginlar soni** emas, **bir vaqtda faol** foydalanuvchilar va **og‘ir amallar** (POST, uzoq tranzaksiya).

### 7.3 Qisqa tavsiyalar (operatsion)

1. Ish vaqtida **bitta tab** har xodimda.
2. Bir omborda **bitta aktiv inventarizatsiya** (kodda ham tekshiriladi).
3. Katta qabulni pik vaqtda bo‘lmasin.
4. 503 da 10–15 s kutib **bir marta** qayta urinish; davom etsa — log.

---

## 8. Deploy va migratsiya checklist

Pushdan keyin har safar:

| # | Qadam | Qayer |
|---|-------|-------|
| 1 | API deploy **Success** | Railway → Deployments |
| 2 | `npx prisma migrate deploy` | Railway Shell (`apps/api`) |
| 3 | API **Restart** (env o‘zgarganda) | Railway |
| 4 | Web deploy (agar `apps/web` o‘zgardi) | Vercel |
| 5 | `API_PROXY_TARGET` = Railway URL | Vercel env |
| 6 | Funksional smoke test | Login, ombor, inventarizatsiya POST |

**Tez-tez xatolar:**

- Migratsiya qo‘llanmagan → jadval yo‘q → 500 (ba’zan deploy vaqtida 503)
- `DATABASE_URL` da noto‘g‘ri `:5432` (session) ilova uchun — `database-url.ts` 6543 ga o‘tkazadi; migratsiya uchun **DIRECT_URL** kerak
- Faqat web push, API push yo‘q — frontend yangi, backend eski

Batafsil: [10-deploy-auth.md](./architecture/10-deploy-auth.md), [RAILWAY-SUPABASE-DATABASE.md](./RAILWAY-SUPABASE-DATABASE.md).

---

## 9. Diagnostika tartibi (qadamma-qadam)

### 9.1 Brauzer

1. F12 → **Network** → filtrlash: `inventory-counts` yoki `api`
2. **Status**, **Time**, **Response** body
3. 503 matn: `bazasi band` vs bo‘sh (proxy timeout)

### 9.2 Railway

1. **HTTP Logs** — POST vaqti va status
2. **Deploy Logs** — start xatosi, Prisma, Redis
3. Shell: `npx prisma migrate status`

### 9.3 Ajratish jadvali

| GET 200, POST 503 | Og‘ir POST / timeout — inventar patch, chunk |
| Hammasi 503 | API down, deploy failed, pool to‘lib |
| Hammasi 401 | Token/sessiya — qayta login |
| Faqat sekin, 200 | Ko‘p so‘rov / katta ma’lumot — optimizatsiya, kamroq tab |

---

## 10. Reja: barqarorlikni oshirish (keyingi ishlar)

### 10.1 Qisqa muddat (kod / operatsiya)

- [x] Inventarizatsiya `startCount` — chunk tranzaksiya (2026-06-03, `inventory-count.service.ts` + `INVENTORY_BLOCK_CHUNK_SIZE`)
- [ ] **Production deploy tekshiruvi:** Railway logda `POST /api/inventory-counts` → **200** (~2–5 s), 503 yo‘q.
- [x] `connection_limit` default **15** (`database-url.ts`); Railway `DATABASE_URL` da ham `connection_limit=15` qo‘ying.
- [x] Redis cache: `auth/me` (60s), `companies/features` (5 daq), `inventory-counts` ro‘yxati (30s) — `getOrSet` + invalidatsiya.
- [x] Frontend: owner `refetchQueries(session)` olib tashlandi; Settings `useSession` (dublikat `getMe` yo‘q).
- [ ] Juda katta ombor (1000+ SKU): inventar bloklashni fon/queue ga ajratish (agar 503 davom etsa)

### 10.2 O‘rta muddat (infratuzilma)

- [ ] Supabase / Prisma `connection_limit` va Railway instansiya soni moslashtirish
- [ ] Redis cache kengaytirish (permissions allaqachon 60 s memory cache)
- [ ] Monitoring: P2028, 503, o‘rtacha response time

### 10.3 Uzoq muddat

- [ ] 10+ bir vaqtda foydalanuvchi uchun: API replica, queue (BullMQ) og‘ir ishlar uchun
- [ ] Rate limit / kompaniya bo‘yicha concurrent og‘ir operatsiya cheklovi

---

## 11. Kod manbalari (tez havola)

| Mavzu | Fayl |
|-------|------|
| Inventarizatsiya API | `apps/api/src/modules/warehouses/inventory-count.controller.ts` |
| Inventarizatsiya biznes | `apps/api/src/modules/warehouses/inventory-count.service.ts` |
| Chunk o‘lchami | `apps/api/src/prisma/transaction-options.ts` |
| P2028 → 503 | `apps/api/src/common/filters/prisma-exception.filter.ts` |
| DB pool | `apps/api/src/prisma/database-url.ts` |
| Web inventarizatsiya | `apps/web/src/services/inventory-count.service.ts` |
| Sessiya | `apps/web/src/hooks/use-session.ts` |
| API proxy | `apps/web/next.config.js`, `apps/web/src/app/api/[[...path]]/route.ts` |
| Katta qabul namunasi | `apps/api/src/modules/goods-receipts/goods-receipt-accept.service.ts` |

---

## 12. FAQ

**Savol:** Git push qildim, 503 chiqdi — nima noto‘g‘ri?  
**Javob:** Ko‘pincha API deploy + **migrate deploy** yoki og‘ir POST timeout. GET 200 bo‘lsa — route to‘g‘ri, POST ni alohida tuzatish kerak.

**Savol:** Parollar serverda saqlanadimi?  
**Javob:** Yo‘q. Faqat JWT (`sessionStorage`) va user profil (`localStorage`).

**Savol:** 3 ta xodim ishlasa yetadimi?  
**Javob:** O‘qish uchun — odatda ha. Hammasi og‘ir ombor amali qilsa — 503 ehtimoli oshadi; patch va operatsion qoidalar yordam beradi.

**Savol:** `/api/health` 404?  
**Javob:** Endpoint yo‘q; xato emas.

---

*Hujjat suhbat va production loglar asosida yozilgan. Yangi muammo topilsa — §9 diagnostika + Railway log skrinshot bilan yangilang.*
