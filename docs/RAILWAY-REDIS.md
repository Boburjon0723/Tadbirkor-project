# Railway Redis — API bilan ulash

Redis Railwayda alohida servis sifatida ishlaydi. **API** o‘z logikasida faqat `REDIS_URL` (yoki quyidagi aliaslar) orqali ulanadi.

## Railway sozlash

1. Loyihada **Redis** servisi bor (Running).
2. **API** servisini oching → **Variables**.
3. **Add Reference** → Redis servisini tanlang → `REDIS_URL` (yoki `REDIS_PRIVATE_URL`) qo‘shing.

Natijada API Variables da shunday ko‘rinadi:

```text
REDIS_URL=${{Redis.REDIS_URL}}
```

Yoki qo‘lda Redis servisidagi **Connect** → **Private URL** ni nusxalab:

```text
REDIS_URL=redis://default:PAROL@redis.railway.internal:6379
```

Tashqi (TLS) URL bo‘lsa odatda `rediss://` bilan boshlanadi — kod buni qo‘llab-quvvatlaydi.

4. **Redeploy** API servisi (Restart yetarli emas, yangi env uchun deploy kerak).

## Logda tekshirish

**Muhim:** `app-cache.service.ts` da `console.log` **yo‘q** — Nest **`Logger`** ishlatiladi. Railway logda qidiring:

```text
[AppCacheService]
```

API ishga tushganda:

| Log (qismi) | Ma’nosi |
|-------------|---------|
| `Redis cache ulandi (...)` | Kesh Redisda, PING OK |
| `Redis cache: REDIS_URL bor, ulanish boshlandi` | URL bor, ulanish jarayonida |
| `REDIS_URL topilmadi — cache xotira` | API Redis ko‘rmayapti — reference qo‘shilmagan |
| `Redis ulanmadi, in-memory cache` | URL bor, lekin ulanish/PING xato |
| `Redis import queue ulandi (BullMQ)` | Excel import fon navbat Redisda (`ProductImportService`) |

Agar **hech biri** chiqmasa:

1. Log **Railway API** servisidami (Vercel emas)?
2. Deploy **eski build**mi — yangi kod push qilinganmi?
3. `connect()` osilib qolgan bo‘lishi mumkin (endi `connectTimeout: 10s`).

### API orqali tekshirish (platform admin)

Deploydan keyin (JWT + platform admin):

```http
GET /api/platform/redis-health
Authorization: Bearer <token>
```

Javob namunasi:

```json
{
  "cache": { "redisConfigured": true, "redisReady": true, "mode": "redis", "hostHint": "redis.railway.internal:6379" },
  "ping": { "ok": true, "latencyMs": 2 }
}
```

| `cache.mode` | `ping.ok` | Ma’nosi |
|--------------|-----------|---------|
| `redis` | `true` | Redis ishlayapti |
| `memory` | `false` | REDIS_URL yo‘q yoki ulanmagan — in-memory |
| `redis` | `false` | URL bor, lekin ulanish uzilgan |

## Nima Redis ishlatadi

- **AppCacheService** — dashboard KPI, kategoriyalar, buyurtma hub statistikasi, POS katalog
- **BullMQ** — katta Excel import (`>150` qator) fon rejimida

Socket (`/inventory`) Redis talab qilmaydi — u alohida WebSocket.

## Lokal ishlab chiqish

`apps/api/.env` ga Railway **public** URL ni qo‘yishingiz mumkin (faqat dev):

```env
REDIS_URL="rediss://default:...@xxx.up.railway.app:6379"
```

Yoki lokal Docker:

```env
REDIS_URL="redis://localhost:6379"
```

`infra/docker-compose.yml` da `redis` servisi bor.

## Tez-tez xatolar

- Redis ishlaydi, lekin **API Variables** da `REDIS_URL` yo‘q → in-memory + local import fallback.
- **Ikki API replika** + bitta Redis — odatda muammo emas; connection limit past bo‘lsa Railway Redis planni tekshiring.
- `rediss://` + TLS xatosi — `redis-connection.ts` da `tls: {}` yoqilgan; URL to‘liq nusxalanganini tekshiring.
