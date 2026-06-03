# POS UX qayta tuzish — reja

> Maqsad: chakana mijoz, qarz va to‘lovlar **bitta joyda** ko‘rinsin; tarix alohida saqlansin; menyuda chalkashlik yo‘qolsin.

---

## Hozirgi muammo

| Menyu | Yo‘l | Nima noto‘g‘ri |
|--------|------|----------------|
| POS Tarixi | `/dashboard/pos` | Faqat cheklar ro‘yxati |
| Chakana mijozlar | `/dashboard/retail-customers` | Faqat ism/telefon, **qarzi ko‘rinmaydi** |
| Mijozlar qarzi | `/dashboard/retail-receivables` | Qarzlar ro‘yxati, **kimning ekanligi** tarqoq |
| POS hisoboti | `/dashboard/reports/pos` | Umumiy raqamlar, mijoz bilan bog‘lanmaydi |

Foydalanuvchi: «Qarz kimniki?» — 3 ta sahifaga sakrab topish kerak.

---

## Yangi tuzilma (sidebar)

**POS moduli yoqilganda faqat:**

| # | Menyu | Yo‘l | Izoh |
|---|--------|------|------|
| 1 | POS / Kassa | `/pos` | O‘zgarishsiz — kassa ekrani |
| 2 | **POS markazi** | `/dashboard/pos` | **2 ta ichki bo‘lim (tab)** |
| 3 | POS hisoboti | `/dashboard/reports/pos` | Umumiy KPI (ixtiyoriy keyin 3-tab qilish mumkin) |

**Olib tashlanadi (menyudan):**
- ~~Chakana mijozlar~~
- ~~Mijozlar qarzi~~

Eski URL lar redirect:
- `/dashboard/retail-customers` → `/dashboard/pos?tab=mijozlar`
- `/dashboard/retail-receivables` → `/dashboard/pos?tab=mijozlar`

---

## `/dashboard/pos` — ichki 2 bo‘lim

```
┌─────────────────────────────────────────────┐
│  POS markazi                                 │
│  [ Cheklar tarixi ]  [ Mijozlar ]            │  ← tab
├─────────────────────────────────────────────┤
│                                              │
│   Tab 1: CHEKLAR TARIXI                      │
│   • Hozirgi `/dashboard/pos` sahifasi        │
│   • O‘zgarishsiz: qidiruv, ro‘yxat, modal    │
│                                              │
│   Tab 2: MIJOZLAR (nasiya yoqilganda)        │
│   • posCreditEnabled=false → tab yashirin     │
│     yoki «Nasiyani yoqing» banner             │
│                                              │
└─────────────────────────────────────────────┘
```

### Tab 1 — Cheklar tarixi
- Mavjud kod `apps/web/src/app/dashboard/pos/page.tsx` → `PosSalesHistoryTab.tsx`
- Hech narsa o‘zgarmaydi (faqat komponentga ko‘chiriladi).

### Tab 2 — Mijozlar (asosiy yangilik)

**Ro‘yxat (har bir mijoz kartochkasi):**

| Maydon | Manba |
|--------|--------|
| Ism, telefon | `RetailCustomer` |
| **Joriy qarz** | `sum(remainingAmount)` OPEN + PARTIAL |
| **Berilgan** | `sum(payments.amount)` |
| **Nasiya savdolari** | receivables soni yoki jami `amount` |
| Oxirgi sotuv | `posSale.completedAt` |

**Mijozni bosganda (panel yoki pastki qism):**
- Ochiq qarzlar ro‘yxati (chek raqami, sana, qoldiq)
- To‘lov qo‘shish (mavjud `POST .../payments`)
- To‘lovlar tarixi (kim, qachon, qancha)

Shu yerda bir kadrda: **kim → qancha qarz → nima to‘lagan**.

**Qo‘shish:** yangi mijoz formasi (hozirgi retail-customers dagi kabi) shu tab ichida.

---

## API (yangi / kengaytma)

### `GET /retail-customers/summary` (yoki `?include=balances`)

Har mijoz uchun:

```json
{
  "id": "...",
  "name": "Ali",
  "phone": "+998...",
  "totalDebt": 1500000,
  "totalPaid": 500000,
  "totalCredited": 2000000,
  "openReceivablesCount": 2,
  "lastSaleAt": "2026-05-20T..."
}
```

Hisoblash:
- `totalDebt` = receivables where status in (OPEN, PARTIAL) → `remainingAmount`
- `totalPaid` = barcha `RetailReceivablePayment.amount`
- `totalCredited` = receivables `amount` jami (yoki faqat OPEN+PARTIAL+PAID)

### `GET /retail-customers/:id/ledger` (ixtiyoriy, 2-bosqich)

Bitta mijoz: receivables + payments + bog‘langan `posSale` — bitta timeline.

Mavjud endpointlar qoladi; faqat agregat qo‘shiladi.

---

## Web fayllar (implementatsiya)

```
apps/web/src/app/dashboard/pos/
  page.tsx                 ← tab shell (?tab=tarix|mijozlar)
  PosSalesHistoryTab.tsx   ← eski tarix
  PosCustomersTab.tsx      ← yangi mijozlar+qarz

apps/web/src/features/pos-retail/
  CustomerBalanceCard.tsx
  CustomerLedgerPanel.tsx
  RecordPaymentForm.tsx

apps/web/src/app/dashboard/retail-customers/page.tsx  → redirect
apps/web/src/app/dashboard/retail-receivables/page.tsx → redirect

apps/web/src/app/dashboard/layout.tsx  ← menyu 4→3
```

---

## Bosqichlar

| Bosqich | Vazifa | Taxmin |
|---------|--------|--------|
| **A** | API: `GET /retail-customers` balances bilan | 0.5 kun |
| **B** | `PosCustomersTab` — ro‘yxat + to‘lov | 1 kun |
| **C** | `/dashboard/pos` tab shell, tarixni ko‘chirish | 0.5 kun |
| **D** | Sidebar + redirectlar | 0.25 kun |
| **E** | POS hisoboti — hozircha alohida qoladi; keyin 3-tab mumkin | — |

**Jami:** ~2 kun ish.

---

## Nima o‘zgarmaydi

- Kassa `/pos` — o‘zi
- `PosSale` / checkout / nasiya logikasi API da
- B2B **Qarz Daftari** (DEBT moduli) — alohida, aralashmaydi
- POS hisoboti (`/reports/pos/summary`) — umumiy statistika

---

## Qabul qilish (test)

1. Menyuda faqat **POS markazi** + Kassa + (ixtiyoriy) Hisobot.
2. Tarix tab — avvalgidek cheklar.
3. Mijozlar tab — har mijozda qarz va to‘langan summa ko‘rinadi.
4. Mijoz tanlanganda — qaysi chekdan qarz va to‘lovlar aniq.
5. Eski bookmarklar redirect ishlaydi.

---

## Keyingi qadam

Reja tasdiqlangach implementatsiya: **A → B → C → D** ketma-ket.
