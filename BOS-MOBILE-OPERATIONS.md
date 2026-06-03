# Axis ERP — BOS (Back Office Operations) Mobil Moduli
## (1C FOS/BOS bo'linishidan ilhomlangan operatsion modul)

> **Asosiy hujjat:** `arxetektura.md` → `docs/architecture/`
> **Bog'liq:** `Sap.md` (ATP/Picking/Inventory backend rejasi), `MOBILE-ARXITEKTURA.md`
> **Versiya:** 1.0 | **Sana:** 2026-06-01 | **Holat:** 🟡 REJA (kod yozilmagan)
> **Maqsad:** 1C dagi Back Office (BOS) operatsion jarayonlarini takomillashtirib, Axis ERP ga **mobil operatsion modul** sifatida qo'shish.

---

## Mundarija

1. [Konsepsiya — nega kerak](#1-konsepsiya--nega-kerak)
2. [FOS/BOS bo'linishi va rol modeli](#2-fosbos-bolinishi-va-rol-modeli)
3. [Ko'lam — nima mobilda, nima webda](#3-kolam--nima-mobilda-nima-webda)
4. [Modul tarkibi](#4-modul-tarkibi)
5. [Mavjud backend (tayyor)](#5-mavjud-backend-tayyor)
6. [Mobil arxitektura](#6-mobil-arxitektura)
7. [Ekranlar](#7-ekranlar)
8. [Implementatsiya bosqichlari](#8-implementatsiya-bosqichlari)
9. [Ochiq savollar](#9-ochiq-savollar)

---

## 1. Konsepsiya — nega kerak

1C va retail avtomatlashtirishda tizim ikkiga bo'linadi:

- **FOS (Front Office System)** — kassa/POS, mijoz oldida ishlaydigan qism.
- **BOS (Back Office System)** — ombor, ta'minot, hisobot, boshqaruv (orqa tomon).

Axis ERP da **boshqaruv qismi (web)** allaqachon kuchli. Lekin **operatsion bajaruv** —
omborchi qo'lida yurib qiladigan ishlar (saralash, sanash, qabul, qoldiq tekshirish) —
hozir asosan web da, mobil da deyarli yo'q.

**Asosiy mantiq:** Bu ishlar jismonan ombor ichida, qo'lda barcode skaner bilan
bajariladi → **mobil ularning tabiiy joyi**. Web sahifada omborchi telefon/skaner bilan
yurib ishlay olmaydi.

**Muhim afzallik:** `Sap.md` rejasi bo'yicha **backend allaqachon yozilgan**
(pick-tasks, inventory-counts, stock/availability endpointlari ishlaydi).
Demak bu modul asosan **mobil frontend ishi** — arzon va tez.

---

## 2. FOS/BOS bo'linishi va rol modeli

Axis ERP da BOS ni **rol bo'yicha** ajratamiz:

| Rol | Qurilma | Vazifa |
|-----|---------|--------|
| **Omborchi / Operator** | 📱 Mobil (asosiy) | Bajaradi: skanerlash, saralash, sanash, qabul |
| **Manager / Egasi** | 💻 Web (asosiy) | Boshqaradi: boshlaydi, tasdiqlaydi, hisobot, sozlama |

> **Tamoyil:** *Bajaruv* — mobilda. *Boshqaruv* — webda.
> "Hamma narsa faqat mobil" qilinmaydi — tasdiqlash, hisobot, sozlama katta ekran talab qiladi.

---

## 3. Ko'lam — nima mobilda, nima webda

### ✅ Mobilga mos (operator, bajaruv)
- Barcode/SKU skaner bilan **saralash (picking)**
- Barcode skaner bilan **inventarizatsiya sanash**
- **Tezkor qoldiq / ATP** — mahsulotni skanerlab erkin/rezerv/blok ko'rish
- **Qabul (goods receipt)** — kiruvchi tovarni skanerlab qabul qilish *(2-bosqich)*

### 💻 Webda qoladi (manager, boshqaruv)
- Inventarizatsiyani **boshlash** (qaysi ombor, qaysi mahsulotlar)
- Variance (farq) ni **tasdiqlash / rad etish**
- Hisobotlar (farqlar, picking tarixi)
- Tolerance va boshqa **sozlamalar**

---

## 4. Modul tarkibi

| # | Funksiya | Ustuvorlik | Backend holati |
|---|----------|-----------|----------------|
| 1 | **Saralash (Pick & Pack)** | Yuqori | ✅ Tayyor |
| 2 | **Inventarizatsiya sanash** | Yuqori | ✅ Tayyor |
| 3 | **Tezkor qoldiq / ATP** | O'rta (eng sodda) | ✅ Tayyor |
| 4 | **Qabul (Goods Receipt)** | Past (2-bosqich) | ✅ Tayyor (goods-receipts) |

---

## 5. Mavjud backend (tayyor)

Hech qanday backend o'zgarishi **kerak emas** — quyidagi endpointlar mavjud:

```
Saralash (Picking):
  GET    /pick-tasks?status=&warehouseId=        → operator vazifalari ro'yxati
  GET    /pick-tasks/:id                          → vazifa detali
  PATCH  /pick-tasks/:id/scan   { barcode, qty }  → barcode tasdiqlash
  PATCH  /pick-tasks/:id/complete                 → vazifani yakunlash

Inventarizatsiya:
  GET    /inventory-counts?status=                → ochiq sanashlar
  GET    /inventory-counts/:id                    → hujjat + qatorlar
  POST   /inventory-counts/:id/scan { barcode, countedQuantity }
  PATCH  /inventory-counts/items/:itemId/count    → miqdor kiritish

ATP / Qoldiq:
  GET    /stock/availability/:variantId           → onHand, reserved, blocked, free
  POST   /stock/availability/batch                → ko'p variant

Qabul (2-bosqich):
  goods-receipts modulidagi mavjud endpointlar
```

**Kod manbalari (backend):**
- `apps/api/src/modules/dispatches/picking.service.ts`, `pick-tasks.controller.ts`
- `apps/api/src/modules/warehouses/inventory-count.service.ts`, `inventory-count.controller.ts`
- `apps/api/src/modules/warehouses/atp.service.ts`, `stock.controller.ts`

---

## 6. Mobil arxitektura

- **Stack:** Expo / React Native (mavjud `mobile/` ilovasi)
- **Auth:** mavjud Bearer token (`axis_access_token`) — qo'shimcha ish yo'q
- **Skaner:** `expo-camera` (barcode) — mobilda `WarehouseImportModal` patterni allaqachon bor
- **API:** mavjud `mobile/src/api` client orqali yangi endpointlarga ulanish
- **Yangi papka:** `mobile/src/screens/operations/`

```
mobile/src/
├── screens/operations/
│   ├── OperationsHomeScreen.tsx      ← modul bosh sahifa (3 ta tugma)
│   ├── PickingListScreen.tsx         ← saralash vazifalari
│   ├── PickingTaskScreen.tsx         ← skaner + miqdor + complete
│   ├── InventoryCountScreen.tsx      ← ochiq sanash → skaner → miqdor
│   └── StockCheckScreen.tsx          ← ATP: skanerlab erkin/rezerv/blok
├── components/operations/
│   └── BarcodeScanner.tsx            ← umumiy skaner komponenti
└── api/operations.ts                 ← endpoint funksiyalari
```

---

## 7. Ekranlar

### 7.1 Operations bosh sahifa
```
┌──────────────────────────────┐
│  Operatsiyalar                │
│                               │
│  [ 📋 Saralash      (3) ]     │
│  [ 🔢 Inventarizatsiya (1) ]  │
│  [ 🔍 Qoldiq tekshirish ]     │
└──────────────────────────────┘
```

### 7.2 Saralash vazifasi (skaner)
```
┌──────────────────────────────┐
│  Dispatch #DSP-001            │
│  Shakar 50kg                  │
│  Kerak: 10 · Saralangan: 4    │
│  ──────────────────────────   │
│  [ 📷 Skanerlash ]            │
│  yoki SKU: [________]         │
│                               │
│  [ Tasdiqlash ✓ ]            │
└──────────────────────────────┘
```

### 7.3 Inventarizatsiya sanash (skaner)
```
┌──────────────────────────────┐
│  INV-20260601-0001            │
│  ──────────────────────────   │
│  [ 📷 Mahsulotni skanerlang ] │
│                               │
│  Shakar 50kg                  │
│  Tizim:    100 dona           │
│  Sanalgan: [____] dona        │
│  Farq:     —                  │
│  [ Saqlash ]                  │
└──────────────────────────────┘
```

### 7.4 Tezkor qoldiq / ATP
```
┌──────────────────────────────┐
│  [ 📷 Skanerlang ]            │
│  ──────────────────────────   │
│  Shakar 50kg     SKU-001      │
│  Jami:    100                 │
│  🔒 Rezerv:  15               │
│  🚫 Blok:     5               │
│  ✅ Erkin:   80               │
└──────────────────────────────┘
```

---

## 8. Implementatsiya bosqichlari

### Bosqich 1 — Asos + Tezkor qoldiq (eng sodda)
| Vazifa | Taxmin |
|--------|--------|
| `expo-camera` skaner komponenti (`BarcodeScanner.tsx`) | 0.5 kun |
| `api/operations.ts` — endpoint funksiyalari | 0.25 kun |
| `OperationsHomeScreen` + navigatsiya | 0.25 kun |
| `StockCheckScreen` (ATP qoldiq) | 0.5 kun |
| **Jami** | **~1.5 kun** |

### Bosqich 2 — Saralash (Picking)
| Vazifa | Taxmin |
|--------|--------|
| `PickingListScreen` (vazifalar ro'yxati) | 0.5 kun |
| `PickingTaskScreen` (skaner + scan + complete) | 1 kun |
| **Jami** | **~1.5 kun** |

### Bosqich 3 — Inventarizatsiya sanash
| Vazifa | Taxmin |
|--------|--------|
| `InventoryCountScreen` (ochiq count → skaner → count) | 1.5 kun |
| Farq ko'rsatish + manager tasdiqlashini kutish holati | 0.5 kun |
| **Jami** | **~2 kun** |

### Bosqich 4 — Qabul (ixtiyoriy)
| Vazifa | Taxmin |
|--------|--------|
| Goods receipt skaner ekrani | 1.5 kun |

**Umumiy taxmin (1–3 bosqich): ~5 kun**

---

## 9. Ochiq savollar

1. **Ko'lam:** "Operator = mobil, Manager = web" modeli tasdiqlanadimi, yoki to'liq mobil-only kerakmi?
2. **Birinchi funksiya:** qaysidan boshlaymiz — Tezkor qoldiq (eng sodda), Saralash, yoki Inventarizatsiya?
3. **Skaner uskunasi:** telefon kamerasi yetarlimi, yoki tashqi USB/Bluetooth barcode skaner ham qo'llanadimi?
4. **Offline rejim:** internet yo'q paytda sanash/saralashni keshlab keyin sync qilish kerakmi? (kelajak bosqich)

---

*Hujjat versiyasi: 1.0 | 2026-06-01 | Axis ERP BOS Mobil Operatsion Modul rejasi*
