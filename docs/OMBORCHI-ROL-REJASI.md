# Omborchi (WAREHOUSE) roli — ko‘rinish va ruxsatlar rejasi

> **Maqsad:** Jamoa uchun bitta manba: omborchi nima ko‘radi, nima qiladi, nima ko‘rmasligi kerak.  
> **Sana:** 2026-06  
> **API roli:** `WAREHOUSE` · **UI nomi:** Omborchi

---

## 1. Qisqa xulosa

| Holat | Izoh |
|--------|------|
| **Asosiy ish** | Saralash (picking), kelgan yuk qabul, qoldiqni ko‘rish |
| **Emas** | Buyurtma qabul, PGI, narx/moliya, katalog boshqaruvi |
| **Kodda qisman tuzatildi** | Menyu (buyurtmalar yo‘q), dashboard KPI, kelgan yuklar soddalashtirildi |
| **Hali qilish kerak** | Ombor `fieldConfig` da narx ustunlarini o‘chirish (egasi, qo‘lda) |

---

## 2. Menyu: ko‘rinadi / ko‘rinmasligi kerak

| Bo‘lim | Hozir (menyu) | Bo‘lishi kerak | API ruxsat | Izoh |
|--------|---------------|----------------|------------|------|
| Asosiy (dashboard) | ✅ | ✅ (operatsion KPI) | `warehouse.view` | Debitor/kreditor yashirildi |
| **Saralash (picking)** | ✅ | ✅ | `warehouse.dispatch` | Asosiy chiqish ishi |
| **Kelgan yuklar** | ✅ | ✅ | `goods_receipts.view/accept` | Xaridor tomonda qabul |
| **Zaxira holati (ATP)** | ✅ | ✅ | `warehouse.view` | Monitoring |
| **Mahsulotlar va qoldiq** | ✅ | ⚠️ faqat **ko‘rish** | `products.view` | Tahrirlash kerak emas — read-only rejim reja |
| **Inventarizatsiya** | ✅ | ✅ **sanash** (tasdiq emas) | `warehouse.adjust` | Tasdiq/yakunlash — `warehouse.manage` |
| Buyurtmalar | ❌ (tuzatildi) | ❌ | `orders.*` yo‘q | Menejer/sotuvchi |
| Hamkorlar, mapping | ❌ | ❌ | yo‘q | |
| Qarz, hisobot, sozlamalar | ❌ | ❌ | yo‘q | |
| POS | ❌ | ❌ | yo‘q | |
| Dala xodimlari | ✅ | ⚠️ ixtiyoriy | field.* bor | Ko‘p kompaniyada kerak emas |

---

## 3. API ruxsatlar (backend `ROLE_PERMISSIONS`)

### Omborchida **bor**

| Ruxsat | Nima uchun |
|--------|------------|
| `products.view` | Katalog/qoldiq ro‘yxati |
| `warehouse.view` | Ombor, ATP, inventarizatsiya ro‘yxati |
| `warehouse.receive` | Qo‘lda kirim (Tez kirim IN) |
| `warehouse.dispatch` | Saralash, qo‘lda chiqim |
| `warehouse.adjust` | Inventarizatsiya boshlash/sanash |
| `goods_receipts.view` | Kelgan yuklar ro‘yxati |
| `goods_receipts.accept` | Yuk qabul |
| `tasks.view` | Vazifalar (agar ishlatilsa) |
| `field.task.*` / `field.stock.view_all` | Dala moduli (agar yoqilgan bo‘lsa) |

### Omborchida **yo‘q** (va bo‘lmasligi kerak)

| Ruxsat | Kimda |
|--------|--------|
| `orders.view/create/accept/send` | Menejer, sotuvchi, egasi |
| `dispatches.create/send` | Menejer, egasi (PGI) |
| `products.create/update/update_price/delete` | Menejer, egasi |
| `warehouse.manage` | Inventarizatsiya tasdiq/yakunlash |
| `warehouse.transfer` | Ko‘chirish |
| `debt.*`, `reports.*`, `partners.manage` | Buxgalter/menejer |
| `users.manage`, `settings.manage` | Egasi |

---

## 4. Sahifa bo‘yicha: hozir vs reja

### 4.1 Asosiy (Dashboard)

| Element | Hozir | Reja |
|---------|-------|------|
| Bugungi chiqim | ✅ | ✅ |
| Kutilayotgan qabul | ✅ | ✅ |
| Debitorlik / Kreditorlik | ❌ yashirildi | ❌ |
| Buyurtmalar grafigi | ❌ | ❌ |
| Ombor harakati / top mahsulot | ✅ | ✅ |

### 4.2 Saralash (picking)

| Amal | Hozir | Reja |
|------|-------|------|
| Vazifalar ro‘yxati | ✅ | ✅ |
| Skaner, miqdor | ✅ | ✅ |
| Vazifani tugatish | ✅ | ✅ |
| **PGI (yukni yuborish)** | ❌ tugma yashirildi | ❌ menejer/egasi (`dispatches.send`) |

### 4.3 Kelgan yuklar

| Element | Hozir (omborchi UI) | Reja |
|---------|---------------------|------|
| Ro‘yxat, qabul tugmasi | ✅ | ✅ |
| Sotuvchi nomi | ✅ | ✅ |
| **Jami summa** (ro‘yxat) | ❌ yashirildi | ❌ |
| **STIR** | ❌ yashirildi | ❌ |
| Excel (barchasi), chop ro‘yxat | ❌ yashirildi | ❌ |
| Qabul modali: mahsulot, miqdor, **birlik narxi** | ✅ | ✅ (tekshiruv) |
| Qabul modali: jami summa, qarz matni | ❌ yashirildi | ❌ |
| PDF / chop (bitta yuk) | ✅ | ✅ |

### 4.4 Mahsulotlar va qoldiq

| Amal | Hozir | Reja |
|------|-------|------|
| Ro‘yxat, qidiruv, qoldiq ustuni | ✅ | ✅ |
| **Tahrirlash** (narx, zaxira modal) | ❌ read-only UI | ❌ |
| Yangi mahsulot, import, kategoriya | ❌ yashirildi | ❌ |
| Tez kirim/chiqim (katalogdan) | ❌ yashirildi | ❌ |
| Ombor yaratish/sozlama | ❌ yashirildi | ❌ |
| Ombor ustunlari: narx ko‘rsatish | ❌ UI avtomatik yashiriladi | ❌ (`maskWarehouseCatalogFieldConfig`) |
| Batafsil sahifa: sotuv narxi | ❌ yashirildi | ❌ |

**Kelgan yuk:** birlik narxi qoladi (qabul tekshiruvi).

### 4.5 Inventarizatsiya

| Amal | Hozir | Reja (biznes) |
|------|-------|----------------|
| Menyu | ✅ | ✅ yoki faqat «sanash» |
| Yangi sanash, skaner | ✅ (`warehouse.adjust`) | ✅ omborchi |
| Bekor qilish (xato ochilgan) | ✅ (`warehouse.adjust`) | ✅ omborchi |
| Farq tasdiq, yakunlash | ❌ UI yashirildi | ❌ menejer/egasi (`warehouse.manage`) |
| Bildirishnoma (farq) | Menejerga ketadi | ✅ |

**Tavsiya (2 variant):**

- **A)** Omborchi faqat sanaydi → API: `warehouse.adjust` qo‘shish; tasdiq OWNER/MANAGER.
- **B)** Omborchi inventarizatsiyani umuman ko‘rmaydi → menyudan olib tashlash.

### 4.6 Zaxira holati (ATP)

| Amal | Hozir | Reja |
|------|-------|------|
| Ko‘rish | ✅ | ✅ |
| Tahrirlash | Yo‘q | ❌ |

---

## 5. B2B zanjiri: kim nima qiladi

```
Menejer/Egasi:  Buyurtma qabul → Jo‘natma → Saralashga yuborish
Omborchi:        Saralash (skaner) → COMPLETED
Menejer/Egasi:   PGI (yukni yuborish)
─────────────────────────────────────────────
Xaridor kompaniyada:
Omborchi:        Kelgan yuklar → Qabul (ombor tanlash)
```

Omborchi **buyurtma** va **PGI** zanjirida ishtirok etmaydi.

---

## 6. Amaliy reja (ishlar ro‘yxati)

### P0 — Tez (biznes uchun muhim)

| # | Ish | Holat |
|---|-----|--------|
| 1 | Menyudan Buyurtmalar olib tashlash (omborchi) | ✅ qilindi |
| 2 | Dashboard: moliya KPI yashirish | ✅ qilindi |
| 3 | Kelgan yuklar: summa/STIR/excel yashirish, birlik narxi qoldirish | ✅ qilindi |
| 4 | Zaxira maydoni yozish (forma qayta yozilmasin) | ✅ qilindi (deploy kerak) |
| 5 | Ombor `fieldConfig`: kirim/sotuv narxini **o‘chirish** (egasi sozlaydi) | 📋 qo‘lda |

### P1 — Kod

| # | Ish | Holat |
|---|-----|--------|
| 6 | **Mahsulotlar va qoldiq:** omborchi uchun read-only | ✅ |
| 7 | **Picking:** PGI faqat `dispatches.send` | ✅ |
| 8 | **Inventarizatsiya:** `warehouse.adjust` omborchiga (variant A) | ✅ |
| 9 | **Inventarizatsiya:** `warehouse.manage` faqat menejer/egasi UI | ✅ |

### P2 — Yaxshilash

| # | Ish |
|---|-----|
| 10 | Omborchi dashboard: «Kutilayotgan saralash» KPI |
| 11 | Jamoa sahifasida rol izohi: «Omborchi — saralash va yuk qabul» |
| 12 | Test checklist (har yangi deploydan keyin) |

---

## 7. Test checklist (omborchi login)

- [ ] Menyuda: Saralash, Kelgan yuklar, ATP, Mahsulotlar — **Buyurtmalar yo‘q**
- [ ] Dashboard: faqat chiqim + kutilayotgan qabul (moliya yo‘q)
- [ ] Saralash: skaner ishlaydi; PGI tugmasi **ko‘rinmaydi** (menejer yuboradi)
- [ ] Kelgan yuk: qabul ishlaydi; jami summa ko‘rinmaydi
- [ ] Mahsulotlar: qoldiq ko‘rinadi; tahrirlash tugmalari yo‘q
- [ ] Inventarizatsiya: sanash ishlaydi; yakunlash/tasdiq tugmalari yo‘q

---

## 8. Qisqa javoblar (FAQ)

**Omborchi buyurtma qabul qiladimi?**  
Yo‘q. Menejer yoki sotuvchi.

**Kelgan yuklarni ko‘radimi?**  
Ha, qabul qiladi (xaridor kompaniya).

**Narx ko‘radimi?**  
Kelgan yukda — birlik narxi (tekshiruv). Katalogda — ombor sozlamasida narx ustunlari o‘chirilsa ko‘rmaydi.

**99 ni o‘chirib 50 yozsa bo‘ladimi?**  
Menejer/egasi saqlaydi. Omborchi katalog zaxirasini bu yerda o‘zgartirmasligi kerak (Tez kirim yoki jarayon orqali).

---

*Yangilanganda: `docs/OMBOR-B2B-JARAYON-VA-MASLAHATLAR.md` bilan birga o‘qing.*
