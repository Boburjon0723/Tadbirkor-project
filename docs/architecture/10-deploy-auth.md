# Deploy va autentifikatsiya (§35)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 35. Autentifikatsiya, CORS va production deploy

### 35.1 Production sxema

```text
Foydalanuvchi
    ↓
https://www.axis-erp.uz          (Vercel — Next.js 14)
    ├── /dashboard, /pos, …
    └── /api/*  →  proxy  →  Railway NestJS (/api)
                              ├── PostgreSQL (Supabase pooler)
                              ├── Redis (cache, BullMQ)
                              └── Socket.io (/inventory, /notifications)
```

| Qism | Platforma |
|------|-----------|
| Frontend | Vercel — `axis-erp.uz`, `www.axis-erp.uz` |
| API | Railway — `tadbirkor-backend-production.up.railway.app` |

### 35.2 Ikki kanalli autentifikatsiya (2026-05-24)

Mobil Safari va ko‘p brauzerlar **uchinchi tomon cookie** ni bloklaydi (frontend Vercel, API Railway). Shuning uchun ikkala kanal ishlatiladi:

| Kanal | Qayerda | Vazifa |
|-------|---------|--------|
| **httpOnly cookie** | `auth-cookie.ts` | Desktop, same-origin proxy |
| **Bearer JWT** | `sessionStorage` (`axis_access_token`) | Mobil, barcha brauzerlar |

| Qatlam | Fayl |
|--------|------|
| API cookie | `apps/api/src/common/auth-cookie.ts` |
| API guard | `JwtAuthGuard` — cookie **yoki** `Authorization: Bearer` |
| Web token | `apps/web/src/lib/auth-token.ts` |
| Web HTTP | `apps/web/src/lib/api.ts` — interceptor, `resolveApiUrl()`, `getSocketOrigin()` |
| Socket | `inventory-socket.ts`, `notifications-socket.ts` — `auth: { token }` + Railway origin |

Login/register: API `access_token` qaytaradi + `Set-Cookie`. Web ikkalasini ham saqlaydi.

### 35.3 API proxy (axis-erp.uz — 404 oldini olish)

| Fayl | Vazifa |
|------|--------|
| `apps/web/src/app/api/[[...path]]/route.ts` | `/api/*` → Railway (server-side proxy) |
| `apps/web/next.config.js` | `rewrites` — `API_PROXY_TARGET` (default Railway URL) |

`axis-erp.uz` da `resolveApiUrl()` avtomatik `https://www.axis-erp.uz/api` qaytaradi.

### 35.4 CORS (Railway)

`apps/api/src/main.ts` — origin trailing slash normalizatsiyasi.

**`CORS_ORIGINS` (slashsiz):**

```text
http://localhost:3000,https://tadbirkor-frontend.vercel.app,https://www.axis-erp.uz,https://axis-erp.uz
```

| Env | Maqsad |
|-----|--------|
| `CORS_ALLOW_VERCEL_PREVIEW=true` | `*.vercel.app` preview |
| `AUTH_COOKIE_CROSS_SITE=true` | SameSite=None; Secure |

### 35.5 Environment o‘zgaruvchilari

**Railway (API):** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `REDIS_URL`, `SUPABASE_*`, `B2B_ORDER_MAX_LINE_ITEMS`, `TELEGRAM_*`.

**Platforma admin (Railway API — majburiy admin uchun):**

| O‘zgaruvchi | Ma’nosi |
|-------------|---------|
| `PLATFORM_ADMIN_EMAILS` yoki `ADMIN_EMAIL` | DB dagi user email (vergul bilan bir nechta) |
| `PLATFORM_ADMIN_LOGINS` yoki `ADMIN_LOGIN` | DB dagi user login |
| `PLATFORM_ADMIN_PIN` yoki `ADMIN_PASSWORD` | Admin panel qo‘shimcha PIN (≥4 belgi) |

Kirish: oddiy parol bilan `/admin/login` yoki `/dashboard/platform-admin` (avval ERP login). `/admin` endi demo emas — API JWT + env ro‘yxati. Deploydan keyin API ni **restart** qiling.

**Vercel (Web):**

| O‘zgaruvchi | Qiymat |
|-------------|--------|
| `API_PROXY_TARGET` | `https://tadbirkor-backend-production.up.railway.app` |
| `NEXT_PUBLIC_API_URL` | `same-origin` yoki bo‘sh (custom domen avtomatik) |
| `NEXT_PUBLIC_SOCKET_URL` | (ixtiyoriy) Socket uchun to‘g‘ridan Railway |

### 35.6 Deploy checklist (monorepo, 2026-05-25)

| Tekshiruv | Railway (API) | Vercel (Web) |
|-----------|---------------|--------------|
| Root / katalog | **`apps/api`** | repo root yoki `apps/web` (loyiha sozlamasiga qarab) |
| Build muvaffaqiyat | Deployments → Success; `nest build` | TypeScript: `npm run build` |
| DB migratsiya | `npx prisma migrate deploy` (shell) | — |
| `DATABASE_URL` | Port **6543**, `pgbouncer=true` | — |
| Push trigger | To‘g‘ri branch (`main`) + Auto Deploy | GitHub ulanish |

**Tez-tez xatolar:** noto‘g‘ri Railway servis logi (boshqa loyiha); `DATABASE_URL` da `:5432` session limit; Vercel da tip xatosi (`imageUrl: null` — tuzatilgan).

---

