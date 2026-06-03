# Field Service (§33)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 33. Field Service / Dala xodimlari moduli (FIELD_SERVICE)

### 33.1 Maqsad va kontsept

Ofis yoki do‘kondan tashqarida ishlaydigan xodimlar (montajchi, kuryer, ustanovkachi, texnik xizmat) uchun tovar harakati va vazifa nazoratini yuritish. Tizim **ombor → ishchi → mijoz** zanjirini uzilishlarsiz kuzatadi va boshliqqa real-vaqt nazorat beradi.

Yangi rol — **`FIELD_WORKER`** (dala xodimi). Sotuvchi POS ga tushgani kabi, dala xodimi tizimga kirganda to‘g‘ridan-to‘g‘ri mobil (PWA) `/field` ekraniga yo‘naltiriladi va dashboardning boshqa qismlariga kira olmaydi.

Modul kaliti: `FIELD_SERVICE` (EMPLOYEES modulining kengaytmasi sifatida feature toggle bilan).

### 33.2 Yangi rol va ruxsatlar

| Rol | Ombor scope | Asosiy ruxsatlar |
|-----|--------------|------------------|
| FIELD_WORKER | Majburiy (`warehouse_id`) | `field.task.view_own`, `field.task.accept`, `field.task.report`, `field.stock.view_own` |

- Bir ishchi — bitta omborga biriktiriladi (boshlang‘ich nuqta).
- OWNER/MANAGER — barcha vazifalarni ko‘radi va tasdiqlaydi.
- WAREHOUSE — biriktirilgan omborida ishchilarga tovar berish (assign) huquqi.

`PermissionsGuard` va `ROLE_PERMISSIONS` ga `FIELD_WORKER` qo‘shiladi.

### 33.3 Workflow (4 bosqich)

```text
1-bosqich: Vazifa va tovar biriktirish
  OWNER / MANAGER / WAREHOUSE  ─▶  FieldTask yaratadi
  ─ assignee (FIELD_WORKER) tanlanadi
  ─ plannedItems: [{variantId, qty}]
  ─ mijoz, manzil, GPS koord. (ixtiyoriy)
  "Biriktirish" bosilganda:
    ▸ StockMovement: OUT (sourceType = FIELD_ASSIGN)
    ▸ Ombor balansi (StockBalance) AYRILADI  ← muhim
    ▸ UserStock ga shu miqdor qo'shiladi
    ▸ Ishchiga push + Telegram: "Sizga yangi vazifa"
    ▸ OWNER/MANAGER ga bildirishnoma: "Omborda X qoldi → Y ishchiga berildi"

2-bosqich: Ishchi qabul qiladi
  Mobil ilovada "Qabul qildim" → status: IN_PROGRESS
  (QR/shtrix skanerlash bilan tasdiq — v2 da)

3-bosqich: Hisobot kiritish
  Ishchi mobil ilovada "Ishni yakunlash":
    ▸ Har bir item: usedQty / returnedQty / lostQty
    ▸ Foto yuklash — IXTIYORIY (lekin tavsiya etiladi)
    ▸ GPS koord. avtomatik olinadi (browser geolocation)
    ▸ Izoh (ixtiyoriy)
  "Yuborish" → status: REPORTED
  Bu paytda stock balansi O'ZGARMAYDI — faqat hisobot saqlanadi
  OWNER/MANAGER ga Telegram + WS bildirishnoma (inline Tasdiq / Rad tugmalari)

4-bosqich: Boshliq tasdiqlaydi
  APPROVED bosilganda:
    ▸ usedQty   ▸ StockMovement: WORKER_TO_CUSTOMER (UserStock dan ayriladi)
    ▸ returnedQty ▸ StockMovement: WORKER_RETURN (UserStock dan ayriladi, StockBalance ga qo'shiladi)
    ▸ lostQty   ▸ StockMovement: WORKER_LOSS (faqat audit, balans ortmaydi)
    ▸ FieldTask.status = APPROVED
    ▸ Ishchiga push: "Tasdiqlandi"
  REJECTED / NEEDS_FIX:
    ▸ Stock o'zgarmaydi
    ▸ Ishchiga sabab bilan qaytadi, qayta hisobot kiritadi
```

**Asosiy qoida — ikki bosqichli balans:**

1. **Biriktirish paytida** — ombor balansi darhol ayriladi va ishchining `UserStock` balansiga o‘tadi. Boshliq omborni real ko‘rinishida ko‘radi.
2. **Tasdiq paytida** — ishchi balansidan `usedQty` mijozga (chiqim), `returnedQty` esa omborga qaytariladi.

### 33.4 Bildirishnomalar

Bildirgi `notifications` moduli (Socket.IO) va `telegram` moduli orqali yuboriladi.

| Event | Qabul qiluvchi | Kanal |
|--------|----------------|--------|
| `FIELD_TASK_ASSIGNED` | FIELD_WORKER | Push + Telegram |
| `FIELD_STOCK_DECREASED` | OWNER, MANAGER, WAREHOUSE | WS toast + Telegram |
| `FIELD_TASK_REPORTED` | OWNER, MANAGER | WS + Telegram (inline Tasdiq / Rad tugmalari) |
| `FIELD_TASK_APPROVED` | FIELD_WORKER | Push |
| `FIELD_TASK_REJECTED` | FIELD_WORKER | Push (sabab bilan) |
| `WORKER_STOCK_OVERDUE` | OWNER | Telegram (N kundan ortiq tovar ishchida tursa) |

### 33.5 Ma’lumotlar bazasi

#### 33.5.1 UserStock — ishchi balansi
```
UserStock
- id
- company_id
- user_id              ─ FIELD_WORKER
- product_variant_id
- source_warehouse_id  ─ qaysi ombordan olingan
- quantity
- updated_at
@@unique([user_id, product_variant_id, source_warehouse_id])
```

#### 33.5.2 StockMovement — yangi `sourceType` qiymatlari
- `FIELD_ASSIGN` (ombor → ishchi)
- `WORKER_TO_CUSTOMER` (ishchi → mijoz, sarflandi)
- `WORKER_RETURN` (ishchi → ombor, qoldiq)
- `WORKER_LOSS` (audit only)

#### 33.5.3 FieldTask
```
FieldTask
- id, company_id
- assignee_id          ─ FIELD_WORKER userId
- source_warehouse_id
- title, description
- customer_name, customer_phone
- address, lat, lng
- scheduled_at
- status               ─ NEW | ASSIGNED | IN_PROGRESS | REPORTED |
                        APPROVED | REJECTED | NEEDS_FIX | CANCELED
- planned_items (JSON) ─ [{variantId, qty}]
- created_by_id
- approved_by_id, approved_at
- created_at, updated_at
```

#### 33.5.4 FieldTaskReport
```
FieldTaskReport
- id, field_task_id (1:1)
- items (JSON)         ─ [{variantId, usedQty, returnedQty, lostQty}]
- photos (string[])    ─ Supabase Storage URL list (ixtiyoriy, bo'sh bo'lishi mumkin)
- gps_lat, gps_lng     ─ tugma bosilgan paytdagi koord.
- gps_distance_m       ─ FieldTask manzili bilan farq (m)
- comment
- submitted_at
```

#### 33.5.5 FieldTaskApproval (audit)
```
FieldTaskApproval
- id, report_id
- approver_id
- decision             ─ APPROVED | REJECTED | NEEDS_FIX
- reason
- decided_at
- channel              ─ WEB | TELEGRAM
```

### 33.6 API (backend)

**Field worker uchun (mobil):**
- `GET  /field/me/tasks?status=` — mening vazifalarim
- `GET  /field/me/stock` — qo‘limdagi qoldiq
- `POST /field/tasks/:id/accept` — qabul qilish
- `POST /field/tasks/:id/report` — hisobot yuborish (items, photos[], gps)
- `GET  /field/me/history`

**Boshliq uchun (web):**
- `GET   /field/tasks?status=&assigneeId=&warehouseId=`
- `POST  /field/tasks` — vazifa yaratish va biriktirish (stock OUT)
- `PATCH /field/tasks/:id` — tahrirlash (faqat ASSIGNED gacha)
- `POST  /field/tasks/:id/approve`
- `POST  /field/tasks/:id/reject` (reason)
- `GET   /field/workers/:userId/stock` — kim qo‘lida nima bor
- `GET   /field/reports/kpi?from=&to=` — ishlatildi/qaytdi/yo‘qoldi statistikasi

**Ruxsatlar:** `field.task.create`, `field.task.assign`, `field.task.approve`, `field.task.view_all`, `field.stock.view_all`.

### 33.7 Frontend

**Mobil (PWA), faqat FIELD_WORKER:**
- `/field` — bugungi vazifalar
- `/field/tasks/[id]` — vazifa tafsiloti + "Qabul qildim"
- `/field/tasks/[id]/report` — hisobot formasi
- `/field/stock` — mening tovarlarim
- `/field/history` — tasdiqlangan/rad etilgan
- `/field/me` — profil, chiqish

`dashboard/layout.tsx` da `role === 'FIELD_WORKER'` bo‘lsa `router.replace('/field')`.

**Web (OWNER, MANAGER, WAREHOUSE):**
- `/dashboard/field` — vazifalar ro‘yxati + Kanban (status bo‘yicha) + tasdiqlash navbati
- `/dashboard/field/new` — yangi vazifa
- `/dashboard/field/workers` — ishchi balanslari, KPI
- Sidebar: «Dala xodimlari» (modul yoqilganda, OWNER/MANAGER/WAREHOUSE rolda)

### 33.8 GPS va foto

- **GPS:** `navigator.geolocation` orqali olinadi, FieldTask manzili bilan Haversine farq hisoblanadi. Boshliq panelida >500 m bo‘lsa qizil flag.
- **Foto:** ixtiyoriy. Yuklansa Supabase Storage ga boradi (`uploads` moduli orqali). Hisobotda 0..5 ta foto.
- Hech qaysi majburiy emas, lekin sozlamada kelajakda `FIELD_REQUIRE_PHOTO`, `FIELD_REQUIRE_GPS` feature flaglarini qo‘shish mumkin.

### 33.9 KPI va analitika

`/dashboard/field/workers` ekranida har bir FIELD_WORKER bo‘yicha:
- Oyiga vazifalar soni
- Ishlatilgan / qaytarilgan / yo‘qolgan miqdor (variant bo‘yicha)
- O‘rtacha bajarish vaqti
- GPS moslik foizi
- Tasdiqlangan / rad etilgan nisbati

### 33.10 Kelajakdagi kengayish (v2+)

- **QR / shtrix-kod skanerlash** — tovar qabul va sarflashda
- **Oflayn rejim** — IndexedDB + outbox, internet yonganda BullMQ sinxron
- **Marshrut optimizatsiyasi** — bir ishchiga bir nechta vazifa xaritada
- **Mijoz imzosi** — canvas
- **Subscription / kalendar** — takroriy xizmat ko‘rsatish
- **CompanyUserWarehouseAccess** orqali ishchini bir nechta omborga biriktirish

### 33.11 Mavjud tizim bilan integratsiya

| Mavjud qism | Foydalanish |
|---|---|
| `CompanyUser.warehouse_id` | FIELD_WORKER ham SALES kabi scope ishlatadi |
| `PermissionsGuard` + `role-permissions.ts` | Yangi `Permission.FIELD_*` lar + `FIELD_WORKER` map |
| `StockMovement` | Yangi `sourceType` qiymatlari (jadval o‘zgarmaydi) |
| `notifications.gateway` | Yangi event turlari |
| `telegram` modul | Inline Tasdiq / Rad tugmalari (mavjud pattern) |
| `uploads` (Supabase) | Foto saqlash |
| `audit-logs` | Stock harakatlari va tasdiq qarorlari |
| PWA (`manifest.ts`) | Mobil ilova alohida emas — shu PWA ichida `/field` |

---

