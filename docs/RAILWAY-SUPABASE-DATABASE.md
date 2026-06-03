# Railway + Supabase — «max clients reached»

Xato:
```
FATAL: (EMAXCONNSESSION) max clients reached in session mode - pool_size: 15
```

**Sabab:** `DATABASE_URL` da **session pooler** (`:5432`) ishlatilgan. NestJS har restartda ulanish ochadi; limit 15 tez to‘ladi.

## Railway Variables (API servis)

Supabase → **Project Settings → Database → Connection string → Transaction pooler**

| O‘zgaruvchi | Qiymat |
|-------------|--------|
| `DATABASE_URL` | `...@aws-0-XX.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=3` |
| `DIRECT_URL` | `...@aws-0-XX.pooler.supabase.com:5432/postgres` (faqat migrate) |

**Muhim:**
- `DATABASE_URL` da port **`6543`** bo‘lishi kerak (5432 emas).
- Parolda `@`, `#` bo‘lsa URL-encode qiling.

## Tekshirish

Deploy logida quyidagi ogohlantirish **bo‘lmasa** yaxshi:
```
[Prisma] DATABASE_URL session pooler (:5432)...
```

Agar kod avtomatik 6543 ga o‘tkazsa, logda shunday yoziladi — baribir Railway Variables ni to‘g‘rilash tavsiya etiladi.

## Qayta deploy

1. Railway → API service → **Variables** → `DATABASE_URL` ni 6543 qilib yangilang
2. **Redeploy** (yoki Restart)
3. Faqat **bitta** API replika (scale 1) — bir nechta instansiya bo‘lsa limit yana tugashi mumkin

## Lokal

`apps/api/.env`:
```
DATABASE_URL="...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
DIRECT_URL="...pooler.supabase.com:5432/postgres"
```
