# Production monitoring — Axis ERP (Tadbirkor)

> **Maqsad:** Loyiha ishlashini kuzatish, muammolarni erta sezish, katta bosim oldidan server/DB ni o‘stirish.  
> **Stack:** Vercel (web) → Railway (Go backend) → Supabase PostgreSQL + Redis  
> **Bog‘liq:** [PRODUCTION-MUAMMOLAR-VA-YECHIMLAR.md](./PRODUCTION-MUAMMOLAR-VA-YECHIMLAR.md), [RAILWAY-REDIS.md](./RAILWAY-REDIS.md), [RAILWAY-SUPABASE-DATABASE.md](./RAILWAY-SUPABASE-DATABASE.md)

**Oxirgi yangilanish:** 2026-06-11

---

## 1. Nimalarni kuzatamiz?

| Qatlam | Nima | Nima bo‘lsa yomon |
|--------|------|------------------|
| **Uptime** | Sayt ochiladimi, API javob beradimi | 503, timeout, 5xx |
| **Backend** | CPU, RAM, restart | Doim 90%+ CPU, tez-tez crash |
| **Database** | Ulanishlar, sekin so‘rovlar | Pool to‘lgan, 10s+ query |
| **Redis** | Kesh ishlayaptimi | POS katalog har safar sekin |
| **Biznes** | POS, import, qabul | Mijoz shikoyat, qoldiq noto‘g‘ri |

---

## 2. Health check URL lar (hozir mavjud)

### Backend (Railway)

| URL | Kutilgan javob | Ma’nosi |
|-----|----------------|---------|
| `GET https://<railway-domain>/api/health` | `{"ok":true,"service":"backend-go",...}` | Process tirik |
| `GET https://<railway-domain>/api/health/deep` | `{"ok":true,"db":"ok","redis":"ok\|skip",...}` | DB + Redis ping |
| `GET https://<railway-domain>/api/ping` | `pong` | Eng oddiy ping |

**Eslatma:** Uptime uchun `/api/health` yetarli. DB/Redis holatini tekshirish uchun `/api/health/deep` — `db` yoki `redis` xato bo‘lsa HTTP **503**.

### Frontend (Vercel)

| URL | Kutilgan |
|-----|----------|
| `https://axis-erp.uz` | 200, sahifa yuklanadi |
| `https://axis-erp.uz/api/health` | Proxy orqali backend health (Vercel rewrite ishlasa) |

### Platform admin (faqat admin JWT)

| URL | Ma’nosi |
|-----|---------|
| `GET /api/platform/redis-health` | Redis PING holati |

---

## 3. Bepul uptime monitoring (15 daqiqada sozlash)

### Tavsiya: [UptimeRobot](https://uptimerobot.com) yoki [Better Stack](https://betterstack.com) (bepul tier)

**Monitor 1 — Backend to‘g‘ridan**

```
URL:    https://<railway-app>.up.railway.app/api/health
Interval: 5 daqiqa
Alert:  Telegram / email (2 marta ketma-ket fail)
```

**Monitor 2 — Foydalanuvchi yo‘li (Vercel proxy)**

```
URL:    https://axis-erp.uz/api/health
Interval: 5 daqiqa
```

Ikki monitor bir vaqtda yiqilsa → backend muammosi.  
Faqat Monitor 2 yiqilsa → Vercel yoki DNS muammosi.

**Monitor 3 — Frontend sahifa**

```
URL:    https://axis-erp.uz/login
Interval: 15 daqiqa
Keyword: "Kirish" yoki "Axis" (sahifa matni borligini tekshirish)
```

---

## 4. Railway dashboard — har kuni 30 soniya

Railway → **backend** servisi → **Metrics**:

| Metrika | Yashil | Sariq (kuzatish) | Qizil (harakat) |
|---------|--------|------------------|-----------------|
| **CPU** | &lt; 60% o‘rtacha | 60–85% | &gt; 85% doimiy |
| **Memory** | &lt; 70% | 70–90% | &gt; 90% yoki restart |
| **Restart count** | 0 kuniga | 1–2 | 3+ kuniga |
| **Deploy** | Success | — | Failed (logni o‘qing) |

**Harakat (sariq/qizil):**

1. Railway → Settings → **Resources** → RAM/CPU bir pog‘onaga oshiring  
2. Logda `panic`, `connection refused`, `too many clients` qidiring  
3. Supabase pool limitini tekshiring ([RAILWAY-SUPABASE-DATABASE.md](./RAILWAY-SUPABASE-DATABASE.md))

---

## 5. Supabase (PostgreSQL) — haftalik tekshiruv

Supabase Dashboard → **Database** → **Reports**:

| Ko‘rsatkich | Normal | Ogohlantirish |
|-------------|--------|---------------|
| Active connections | &lt; 15 (backend MaxConns=20) | 18+ doimiy |
| Query duration p95 | &lt; 500 ms | &gt; 2 s |
| Disk | &lt; 70% | &gt; 85% |

**Tez-tez sekin bo‘ladigan joylar:**

- Inventarizatsiya **boshlash** (ko‘p qator INSERT)
- Excel import **5000+ qator**
- Katta B2B qabul (100+ mahsulot qatori)

**Harakat:** Supabase plan oshirish yoki og‘ir operatsiyalarni fon navbatiga ko‘chirish.

---

## 6. Redis — haftalik

`REDIS_URL` Railway Variables da borligini tekshiring ([RAILWAY-REDIS.md](./RAILWAY-REDIS.md)).

| Belgilar | Redis ishlamayapti |
|----------|-------------------|
| POS katalog har safar 2–5 s | Kesh yo‘q, har safar DB |
| Dashboard sekin yuklanadi | Dashboard cache ishlamaydi |

**Tekshirish:** Platform admin → redis-health, yoki Railway Redis servisi **Running**.

---

## 7. Chuqur health — `/api/health/deep`

```
GET /api/health/deep
```

**Javob (200):**

```json
{
  "ok": true,
  "service": "backend-go",
  "db": "ok",
  "redis": "ok",
  "uptimeSec": 3600
}
```

| Maydon | Qiymat | Ma’nosi |
|--------|--------|---------|
| `db` | `ok` / `error` | PostgreSQL `SELECT 1` (2 s timeout) |
| `redis` | `ok` / `skip` / `error` | `PONG` / memory-only / Redis xato |
| `ok` | `false` | DB yoki Redis xato → HTTP **503** |

UptimeRobot uchun oddiy `/api/health` yetarli; haftalik tekshiruv yoki muammo paytida `deep` ishlating.

---

## 8. Biznes smoke test — haftada 1 marta (5 daqiqa)

Production da oddiy foydalanuvchi bilan:

| # | Amal | Kutilgan |
|---|------|----------|
| 1 | Login | Dashboard ochiladi |
| 2 | Inventar → mahsulot zaxirasini +1 → saqlash | Qoldiq yangilanadi |
| 3 | POS → 1 ta sotuv | Chek yakunlanadi, qoldiq kamayadi |
| 4 | Ombor → harakatlar tarixi | Yangi IN/OUT ko‘rinadi |
| 5 | Mobil: sahifani yopib qayta ochish | Qayta login talab qilinmasin (7 kun token) |

Biror qadam ishlamasa → log + screenshot, keyin tuzatish.

---

## 9. Ogohlantirish chegaralari (qachon server oshirish kerak)

| Holat | Tavsiya |
|-------|---------|
| 10–30 faol foydalanuvchi, CPU &lt; 50% | Hozirgi plan yetadi |
| POS 3+ kassa, tunda ham CPU &gt; 70% | Railway RAM 2→4 GB |
| `too many clients` log | Supabase pooler + backend `MaxConns` 20→10 yoki DB plan |
| Import 10 000+ qator kuniga | Import worker alohida servis (keyingi bosqich) |
| 503 Vercel proxy, backend OK | Vercel function timeout / to‘g‘ridan API URL mobil uchun |

---

## 10. Incident — birinchi 10 daqiqa tartibi

1. **UptimeRobot** alert keldi mi? Qaysi URL?
2. **Railway** → Logs → oxirgi 50 qator (`error`, `panic`, `fatal`)
3. **Railway** → Metrics → CPU/RAM spike bormi?
4. **Supabase** → Database → connections to‘lib qolganmi?
5. So‘nggi **deploy** muvaffaqiyatlimi? (Git push → auto deploy)
6. Agar shoshilinch: Railway → **Restart** backend (ma’lumot saqlanadi)
7. Foydalanuvchilarga: Telegram guruh / qisqa xabar «Texnik ish, 5–15 daqiqa»

Muammo hal bo‘lgach: qisqa yozuv (vaqt, sabab, nima qilindi) — keyingi safar tezroq topasiz.

---

## 11. Monitoring checklist (bosqichma-bosqich)

### Bugun (15 min)

- [ ] UptimeRobot: `/api/health` + `axis-erp.uz` monitor
- [ ] Telegram/email alert ulangan
- [ ] Railway `REDIS_URL` reference bor

### Bu hafta (30 min)

- [ ] Railway Metrics bir marta ko‘rib chiqildi
- [ ] Supabase connections grafigi ko‘rib chiqildi
- [ ] Smoke test §8 bajarildi

### Oylik

- [ ] Disk / DB o‘sish trendi
- [ ] Eng sekin 3 API (log yoki Supabase query stats)
- [ ] Kerak bo‘lsa server plan oshirish

---

## 12. Kelajak yaxshilanishlar (ixtiyoriy)

| Ustuvorlik | Narsa | Foyda |
|------------|-------|-------|
| Yuqori | Sentry (frontend + backend) | Xatolarni avtomatik yig‘ish |
| O‘rta | Structured JSON log (Railway) | Qidirish oson |
| O‘rta | POS to‘g‘ridan Railway API (mobil) | 100–200 ms tezroq |
| Past | Grafana / Datadog | Katta mijozlar uchun |

---

## 13. Foydali linklar (o‘zingiz to‘ldiring)

| Xizmat | URL |
|--------|-----|
| Railway backend | `https://railway.app/project/...` |
| Vercel | `https://vercel.com/...` |
| Supabase | `https://supabase.com/dashboard/project/...` |
| UptimeRobot | `https://uptimerobot.com/dashboard` |
| Production sayt | `https://axis-erp.uz` |

---

**Xulosa:** Kichik va o‘rta biznes uchun bu monitoring yetarli. Asosiy qoida — **uptime alert + Railway metrics + haftalik smoke test**. Server o‘sishi kerak bo‘lsa, metrikalar oldindan ko‘rsatadi — kutilmagan «yiqilish» kamayadi.
