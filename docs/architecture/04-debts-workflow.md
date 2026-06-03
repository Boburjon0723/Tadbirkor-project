# Qarz va tizim modullari (§17–20)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
17. Debt Module (Qarz Daftari)

> **Eslatma (2026-05-20):** Faqat **B2B** — ikki `Company` (hamkor) o‘rtasidagi qarz (`DebtEntry`). Chakana mijoz nasiyasi — `RetailReceivable` (§30), aralashmaydi.

Kompaniyalar o‘rtasidagi moliyaviy o‘zaro hisob-kitoblarni (balansni) boshqarish. Bu real to‘lov tizimi emas, balki real hayotda bo‘lgan to‘lovlarni tizimda aks ettirish va tasdiqlash uchun xizmat qiladi.

DebtAccount
- id
- company_id
- partner_company_id
- balance
- currency
- updated_at
17.1 Debt Module vazifasi

- Qarzlar ro‘yxati va hamkorlar bo‘yicha umumiy balansni ko‘rish.
- Tovar qabul qilinganda avtomatik qarz (Debt Entry) yaratish.
- Xaridor tomonidan to‘lov yozuvi (Payment Record) yaratish.
- Sotuvchi tomonidan to‘lovni tasdiqlash (Confirm) yoki rad etish (Reject).
- Tasdiqlangan to‘lovlar asosida qarz qoldig‘ini (remainingAmount) kamaytirish.

17.2 Database schema

DebtEntry
- id, debtor_id, creditor_id, amount, remaining_amount, status, receipt_id, created_at, updated_at

DebtPaymentRecord
- id, debt_entry_id, amount, status, notes, created_by, confirmed_by, created_at, updated_at

17.3 Statuslar

DebtEntry Status:
- OPEN: Qarz to‘liq to‘lanmagan.
- PARTIALLY_PAID: Qisman to‘langan.
- PAID: To‘liq to‘langan.
- DISPUTED: E’tiroz bor.
- CANCELLED: Bekor qilingan.

PaymentRecord Status:
- PENDING: Sotuvchi tasdig‘ini kutmoqda.
- CONFIRMED: Sotuvchi to‘lovni oldim deb tasdiqladi.
- REJECTED: Sotuvchi to‘lovni rad etdi.

17.4 API Endpoints

- GET /debts/entries — Barcha qarz yozuvlari
- GET /debts/partners/:partnerCompanyId — Hamkor bilan balans
- POST /debts/:debtEntryId/payment-records — To‘lov yozuvi yaratish (Buyer uchun)
- POST /debt-payment-records/:id/confirm — To‘lovni tasdiqlash (Seller uchun)
- POST /debt-payment-records/:id/reject — To‘lovni rad etish (Seller uchun)
- **POST /debts/partners/:partnerCompanyId/record-bulk-payment** — Qarzdor umumiy summa (FIFO taqsimot, `PENDING`)
- **POST /debts/partners/:partnerCompanyId/confirm-bulk-payments** — Kreditor barcha pending to‘lovlarni tasdiqlaydi

17.5 Qoidalar

- To‘lov faqat DebtEntry’ning `remaining_amount` miqdoridan oshmasligi kerak.
- Faqat xaridor (Debtor) to‘lov yozuvini yaratishi mumkin.
- Faqat sotuvchi (Creditor) to‘lovni tasdiqlashi mumkin.
- To‘lov tasdiqlangandan so‘ng qarz qoldig‘i kamayadi. Agar qoldiq 0 bo‘lsa, qarz statusi `PAID` holatiga o‘tadi.
- Rad etilgan to‘lov qarz balansiga ta’sir qilmaydi.

17.6 Ommaviy to‘lov (FIFO, 2026-05)

**Biznes oqim:** Qarzdor «2500 to‘ladim» deb yozadi (**payable** tab) → Kreditor **receivable** tabda tasdiqlaydi.

| Rol | UI | API |
|-----|-----|-----|
| Qarzdor (buyer) | To‘lanadigan — summa kiritish | `record-bulk-payment` |
| Kreditor (seller) | Qarz oluvchi — «tasdiqlash» | `confirm-bulk-payments` |

**FIFO:** Summa eng eski ochiq `DebtEntry` dan boshlab `remaining_amount` bo‘yicha taqsimlanadi; bir nechta `DebtPaymentRecord` yaratiladi.

**Realtime:** `debts:changed` → `use-debts-realtime.ts` (qarz ro‘yxati yangilanadi).

18. Workflow & Task Module

Buyurtma kelganda yoki qabul qilinganda tizim ichki vazifalar yaratadi.

WorkflowDefinition
- id
- company_id
- event_key
- name
- enabled
WorkflowStep
- id
- workflow_id
- step_key
- department_id
- role_id
- order_index
- required
Task
- id
- company_id
- source_type
- source_id
- title
- description
- assigned_role_id
- assigned_user_id
- department_id
- status
- due_date
- created_at
- completed_at

Event misollar:

b2b_order.received
b2b_order.accepted
dispatch.sent
goods_receipt.accepted
debt.created
payment_record.created
payment_record.confirmed

Masalan:

B2B order accepted:
- Omborga task: tovarni tayyorlash
- Menejerga task: buyurtmani nazorat qilish
- Buxgalterga task: invoice/qarz nazorati
19. Notification Module
Notification
- id
- company_id
- user_id
- type
- title
- message
- status
- source_type
- source_id
- created_at
- read_at

Kanallar:

In-app notification
Email
Telegram bot — keyingi bosqich
SMS — keyingi bosqich
Push notification — keyingi bosqich
20. Audit Log
AuditLog
- id
- company_id
- user_id
- action
- entity_type
- entity_id
- old_value_json
- new_value_json
- ip_address
- user_agent
- created_at

Audit qilinadigan amallar:

login
user.created
role.updated
product.created
product.price_updated
stock.adjusted
order.sent
order.accepted
dispatch.sent
goods_receipt.accepted
debt.created
payment_record.confirmed
