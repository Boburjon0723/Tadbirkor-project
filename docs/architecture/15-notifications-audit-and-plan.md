# Notifications Audit va Optimallashtirish Rejasi

Sana: 2026-05-27  
Loyiha: Axis ERP / Tadbirkor  
Qamrov: API + Web + Telegram bildirishnoma oqimlari

---

## 1) Hozirgi holat (qisqa)

Loyihada bildirishnomalar 3 kanalda ketmoqda:

1. **In-app DB notification** (`Notification` jadvali orqali)
2. **Realtime socket** (`/notifications` namespace, `notification:*` eventlar)
3. **Telegram bot** (`TelegramService.sendToCompany`, `sendToChat`, callback actionlar)

Asosiy ijobiy tomonlar:
- biznes oqimlari bo‘yicha xabar yuborish joylari ko‘p modulda bor;
- Telegram yuborish xatosi asosiy tranzaksiyani to‘xtatmaydi (to‘g‘ri qaror);
- socket auth JWT bilan himoyalangan;
- role-based telegram broadcast qo‘llab-quvvatlangan.

---

## 2) Topilgan zaifliklar va risklar

### A. Arxitektura va izchillik

1. **Yagona Notification Orchestrator yo‘q**  
   Har modul `NotificationsService` yoki `TelegramService`ni turlicha chaqiradi. Natija: formatlar turli, event nomlari bir xil emas, regressiya ehtimoli yuqori.

2. **Kanal bo‘yicha source-of-truth yo‘q**  
   In-app xabari yaratildi, lekin Telegram yoki socket real yetib borgani kuzatilmaydi (`delivery state` yo‘q).

3. **Qo‘shaloq signal + polling overlap**  
   Frontend socket signal oladi va shu bilan birga har 30 sekund polling qiladi. Katta yukda ortiqcha API chaqiriq va UI jitter bo‘ladi.

### B. Ishonchlilik (Reliability)

4. **Retry / DLQ / backoff qatlamlari yo‘q**  
   Telegram `sendMessage` muvaffaqiyatsiz bo‘lsa faqat log bo‘ladi; keyin qayta yuborish tizimli emas.

5. **Idempotency / dedup mexanizmi yetishmaydi**  
   Bir event bir necha marta trigger bo‘lsa bir xil notification ko‘payishi mumkin.

6. **Cache invalidation noaniq**  
   `companyUserIdsCache` 60s TTL bilan saqlanadi; kompaniya user ro‘li o‘zgarsa tezda aks etmasligi mumkin.

### C. Kuzatuvchanlik (Observability)

7. **Structured monitoring metrikalari yo‘q**  
   `sent / failed / latency / retry_count` kabi metrikalar yo‘q; faqat console log.

8. **Correlation ID / event trace yo‘q**  
   Xabar qayerdan kelib chiqqanini event-to-event kuzatish qiyin.

### D. Xavfsizlik va compliance

9. **Socket token source ko‘p nuqtali** (`auth`, header, query, cookie)  
   Query token fallback kerak bo‘lmagan joylarda xavf yuzasini oshiradi.

10. **PII minimization standart emas**  
    Xabarlarda telefon, summa, izoh yuborilishi bor; retention/purge siyosati formal emas.

### E. UX zaifliklari

11. **Notification Center pagination/filter yo‘q**  
    Hozir `take:50`; ko‘p event bo‘lsa foydalanuvchi qidirib topolmaydi.

12. **Priority/severity boshqaruvi sust**  
    INFO/WARNING/SUCCESS bor, lekin SLA-critical eventlar uchun alohida e’tibor (sticky/high-priority) yo‘q.

13. **Action feedback loop cheklangan**  
    Telegram actionlar bor, lekin UI’da holat timeline ko‘rinishi (event log) standartlashmagan.

---

## 3) Tezkor optimallashtirish (Quick Wins, 2-5 kun)

1. **Pollingni adaptive qilish** — ✅ (2026-05-27)
   - socket ulangan: 5 min; uzilgan: 30 s.

2. **Notification event schema ni birxillashtirish** — ✅ qisman (2026-05-27)
   - `apps/api/src/modules/notifications/notification-events.ts`
   - `NotificationsService.notifyCompanyEvent()` + 5 min dedup (in-memory)
   - Partner ledger: `partner_ledger.sale_order.confirmed` / `.dispatched`

3. **Unread count optimizatsiya** — ✅ (2026-05-27)
   - socket eventlarida `setQueryData`, `markAsRead` lokal yangilash.

4. **Error loglarni structured formatga o‘tkazish** — ✅ qisman (2026-05-27)
   - `NotificationsService` va partner-ledger Telegram: `Logger.warn` + `channel`, `eventKey`, `companyId`.

5. **Notification Centerga filter** — ✅ (2026-05-27)
   - `all/unread`, `severity` (module filter — keyingi sprint).

---

## 4) O‘rta muddatli reja (2-4 hafta)

### 4.1 Notification Domain Layer
- `NotificationOrchestrator` (yagona entrypoint) joriy qilish:
  - `publish(event)` -> channel policy -> in-app/socket/telegram.
- Modul service’lar to‘g‘ridan-to‘g‘ri telegram yubormasdan orchestratorga event yuboradi.

### 4.2 Delivery Tracking
- `NotificationDelivery` jadvali: — ✅ (2026-05-27)
  - `notificationId`, `channel`, `status(PENDING/SENT/FAILED/RETRYING/DEAD)`, `attempt`, `lastError`, `sentAt`.
- Telegram/soket yuborish natijasini shu jadvalda saqlash. — ✅ Telegram (company + chat)

### 4.3 Retry Pipeline
- BullMQ queue: `notifications-delivery` — ✅ (2026-05-27)
- exponential backoff + max attempts + dead-letter queue. — ✅ (5 urinish, DEAD holat)

### 4.4 Idempotency
- `dedupKey` (masalan: `module:event:entity:version`) bo‘yicha 5-15 min duplicate suppression.

---

## 5) Uzoq muddatli reja (1-2 oy)

1. **User Notification Preferences**
   - modul bo‘yicha `mute`, kanal bo‘yicha `telegram/in-app`.

2. **Template Engine**
   - event uchun markdown/text shablonlari (`uz`, keyin `ru/en`).

3. **SLA Dashboards**
   - sent rate, fail rate, p95 delivery latency.

4. **Compliance**
   - retention policy (`notifications`: 90 kun, `delivery logs`: 30 kun, configurable).

---

## 6) Prioritetlash (P0/P1/P2)

### P0 (darhol)
- Polling/socket overlapni optimallashtirish
- Structured logging
- event schema standartlash

### P1 (yaqin sprint)
- NotificationOrchestrator
- Delivery tracking + retry queue
- dedup key

### P2 (keyingi)
- preferences, template engine, advanced analytics

---

## 7) Tavsiya etilgan implementatsiya ketma-ketligi

1. **Sprint-1**
   - `NotificationEvent` DTO standartini qo‘shish
   - frontend adaptive polling
   - notification center filterlar

2. **Sprint-2**
   - orchestrator + queue + delivery table
   - telegram retry & DLQ

3. **Sprint-3**
   - preferences + template + retention jobs

---

## 8) “Definition of Done” (bildirishnoma tizimi)

Done bo‘lishi uchun:
- har event uchun yagona `eventKey`;
- in-app, socket, telegram delivery holati kuzatiladi;
- failure retry ishlaydi va dead-letterda ko‘rinadi;
- frontend realtime + polling optimized;
- critical eventlar 99%+ yetkazish ko‘rsatkichiga ega;
- audit trail orqali event manbasi kuzatiladi.

---

## 9) Hozirgi loyiha uchun aniq keyingi 5 task

1. ~~`notifications` uchun standart event contract~~ — ✅ `notification-events.ts` + `notifyCompanyEvent`
2. ~~`useNotifications` adaptive polling~~ — ✅
3. API’da `NotificationDelivery` model + migration yaratish — **keyingi**
4. `TelegramService` yuborishlarini queue workerga ko‘chirish — **keyingi**
5. Notification Center: module filter + pagination — **keyingi** (severity/unread ✅)

## 10) Qo‘shimcha backlog qaydi

- Web (`/dashboard/orders`) mapping bo‘limida xatolik bor; keyingi iteratsiyada alohida bugfix qilinadi.
- Critical: B2B mahsulot round-trip (`A -> B -> A`) oqimida reverse mapping topilmaganda mahsulot qayta kirimi yangi variant sifatida yaratilishi mumkin. Chuqur tahlil: `docs/architecture/16-product-flow-bug-analysis.md`.

