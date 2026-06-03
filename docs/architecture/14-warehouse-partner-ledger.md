# Ombor ↔ Hamkor daftari integratsiyasi

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)
> **Holat:** Reja (2026-05-26). Modullar: `WAREHOUSE`, `PARTNER_LEDGER`.

---

## 1. Maqsad

Ombor harakatlarini (kirim/chiqim) **Hamkor daftari** modulidagi tegishli hamkor kartochkasiga avtomatik bog‘lash:

- **Kirim (xomashyo/tovar)** → daftarga `MATERIAL_IN` operatsiyasi (biz ularga qarzdor bo‘lamiz).
- **Chiqim (sotuv)** → daftarga `SALE_OUT` operatsiyasi (ular bizga qarzdor bo‘ladi).

Asosiy talab: **ombor modulining mavjud logikasiga deyarli tegmaslik**. Daftarga yozish — kichik “ulagich” servis orqali so‘nggi qadamda amalga oshiriladi.

---

## 2. Domen va qoidalar

### 2.1 Balans yo‘nalishi (daftar)

| Operatsiya | Balans ta’siri | Ma’nosi |
|------------|----------------|---------|
| `MATERIAL_IN` | `−` | Biz hamkordan tovar oldik → biz ularga qarzdormiz |
| `SALE_OUT` | `+` | Biz hamkorga tovar berdik → ular bizga qarzdor |
| `RECEIPT_FROM_PARTNER` | `−` | Hamkor pul yubordi → bizning qarzimiz kamayadi |
| `PAYMENT_TO_PARTNER` | `+` | Biz hamkorga pul to‘ladik → ularning qarzi kamayadi |

> Sxemaning to‘liq tavsifi: [partner-ledger.types.ts](../../apps/api/src/modules/partner-ledger/partner-ledger.types.ts)

### 2.2 Qoidalar

1. **Hamkor tanlash ixtiyoriy** — eski oqim buzilmasin. Hamkor tanlanmagan harakat oddiy ombor harakati bo‘lib qoladi.
2. **Bir tomonlama yozuv** — ombor harakati daftarga yoziladi; daftar operatsiyasi ombor zaxirasiga ta’sir qilmaydi.
3. **Idempotent** — bir harakat ikki marta daftarga yozilmaydi (`sourceType + sourceId` unique kombinatsiyasi).
4. **Bekor qilish — teskari yozuv** — ombor harakati bekor qilinsa, daftarga aksincha yozuv qo‘shiladi (tarix saqlanadi, mavjud yozuv o‘zgarmaydi).
5. **Valyuta** — har operatsiya o‘z valyutasida; aralashsa, har valyutaga **alohida** daftar yozuvi.

---

## 3. Ma’lumotlar modeli

### 3.1 Mavjud entity lar (o‘zgarmaydi)

- `StockMovement` — ombor harakati (kirim/chiqim, qoldiq manbai).
- `PartnerLedgerContact` — hamkor kartochkasi.
- `PartnerLedgerOperation` — daftar operatsiyasi.

### 3.2 Yangi maydonlar (`PartnerLedgerOperation`)

| Maydon | Tur | Tavsif |
|--------|-----|--------|
| `sourceType` | `String?` | `STOCK_IN_EXCEL`, `STOCK_IN_MANUAL`, `STOCK_OUT_MANUAL`, `MANUAL` (default) |
| `sourceId` | `String?` | Manba yozuv ID si (`StockMovement.id` yoki `ProductImportJob.id`) |
| `reversedById` | `String?` | Teskari yozuv ID si (bekor qilinganda) |
| `quantity` | `Decimal?` | Ixtiyoriy — ombor harakati miqdori |
| `productSummary` | `String?` | Qisqa matn: “Mahsulot A ×10, B ×3” |

**Indekslar:**
- `(companyId, sourceType, sourceId)` — duplikat tekshiruvi.

### 3.3 Migration

Yangi migration: `2026XXXX_partner_ledger_stock_source` — yuqoridagi maydonlar va indeks.

---

## 4. Arxitektura

### 4.1 Yangi servis

`PartnerLedgerLinkService` (yangi fayl: `apps/api/src/modules/partner-ledger/partner-ledger-link.service.ts`).

```ts
// Public API (taxminiy)
recordFromStockInbound(input: {
  companyId: string;
  userId: string;
  contactId: string;
  sourceType: 'STOCK_IN_EXCEL' | 'STOCK_IN_MANUAL';
  sourceId: string;
  amounts: Array<{ amount: number; currency: 'UZS' | 'USD' }>;
  productSummary?: string;
  notes?: string;
  operationDate?: Date;
}): Promise<{ operationIds: string[] }>;

recordFromStockOutbound(input: {
  ...
  sourceType: 'STOCK_OUT_MANUAL';
}): Promise<{ operationIds: string[] }>;

reverseBySource(input: {
  companyId: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  reason?: string;
}): Promise<{ reversedIds: string[] }>;
```

Qoidalar:
- `findFirst({ sourceType, sourceId })` bilan duplikat tekshiruvi.
- Bir nechta valyuta → bir nechta operatsiya (har valyutaga bittadan).
- Audit log: `partner_ledger.linked_from_stock`.

### 4.2 Hozirgi modullarda o‘zgarish (minimal)

| Modul | O‘zgarish | Qator soni (taxminiy) |
|-------|-----------|----------------------|
| `WarehousesService.adjustStock` | Optional `contactId` qabul qilish, oxirida `PartnerLedgerLinkService` chaqirish | ~5 |
| `WarehousesService.bulkAdjust` (chiqim) | Xuddi shu | ~5 |
| `ProductImportService.confirmJob` | Job metadata da `contactId` saqlash; success bo‘lganda daftarga yozish | ~10 |
| `StockMovement` o‘chirilganda (agar bo‘lsa) | `reverseBySource` chaqirish | ~3 |

> Ombor logikasining o‘zi (`StockBalance`, `StockMovement`, validatsiya) **umuman o‘zgartirilmaydi**.

### 4.3 Frontend

Yangi UI elementlar:

1. **Kirim modali** (`AddStockMovementModal`) — “Hamkor (ixtiyoriy)” select.
2. **Chiqim modali** — xuddi shu select.
3. **Excel import wizard** — birinchi qadamga “Bu kirim qaysi hamkordan?” bo‘limi:
   - radio: `Hamkor yo‘q` / `Daftardan tanlash` / `+ Yangi qo‘shish`.
4. **Daftar operatsiyasi** kartochkasida “Ombor manbai” badge va havola.
5. **Ombor harakati ro‘yxati** da hamkor nomi (agar bog‘langan bo‘lsa).

### 4.4 API endpoint lari

Yangi:
- `GET /partner-ledger/contacts/select` — qisqa ro‘yxat (id, name, phone, side). Ruxsat: `WAREHOUSE` ham ko‘ra olsin (faqat tanlash uchun).

O‘zgartirilgan:
- `POST /warehouses/:id/stock-adjust` — body ga ixtiyoriy `partnerLedgerContactId` qo‘shildi.
- `POST /product-import/confirm` — body ga ixtiyoriy `partnerLedgerContactId`.

---

## 5. Ish oqimi (oqim diagrammasi)

### 5.1 Qo‘lda kirim

```
[UI: Kirim modali]
    │  productVariant, qty, narx, valyuta
    │  partnerLedgerContactId (ixtiyoriy)
    ▼
[StockService.adjust]  ◄── ombor mantiqi o‘zgarmaydi
    │  StockMovement IN yaratiladi
    │
    ├── agar contactId yo‘q → tugadi
    ▼
[PartnerLedgerLinkService.recordFromStockInbound]
    │  duplikat tekshiruvi
    │  amount = qty × kirim narxi (har valyutaga alohida)
    ▼
[PartnerLedgerOperation MATERIAL_IN] (1 yoki 2 ta)
```

### 5.2 Excel import

```
[UI Wizard: 1-qadam]
    │  contactId tanlash
    ▼
[ProductImportJob: metadata.contactId saqlanadi]
    │
    ▼
[Job ishlashi: success rows]
    │  jami summa hisoblanadi (kirim narxi × qty, valyuta bo‘yicha)
    ▼
[PartnerLedgerLinkService.recordFromStockInbound]
    │  sourceType=STOCK_IN_EXCEL, sourceId=jobId
    ▼
[Daftar yozuvi yaratiladi — bitta (yoki har valyutaga bittadan)]
```

### 5.3 Bekor qilish

```
[Ombor harakati o‘chirilsa]
    ▼
[PartnerLedgerLinkService.reverseBySource]
    │  manba bo‘yicha operatsiyani topadi
    ▼
[Teskari yozuv: belgi qarama-qarshi, reversedById bog‘lanadi]
```

---

## 6. UX qoidalari

1. **Tanlash UI tez bo‘lsin** — kontaktlar select avtocomplete + qidiruv (telefon yoki ism bo‘yicha).
2. **Yangi hamkor qo‘shish** — modal ichida, sahifa tashlamasdan.
3. **Aniq ko‘rsatma** — modalda kichik izoh: “Bu kirim hamkor daftariga yoziladi”.
4. **Daftar yozuvi himoyalangan** — ombor manbaidan kelgan yozuv qo‘lda tahrirlanmaydi (faqat ombor harakati orqali). Tahrirlash kerak bo‘lsa, foydalanuvchi ombor harakatini o‘zgartiradi.
5. **B2B aralashmasligi uchun** — agar `linkedPartnerId` bor (kelajakda B2B `Partner` bilan bog‘langan kontakt) — UI da ogohlantirish: “Bu hamkor B2B tizimda ham bor. Qarz daftarini tekshiring.”

---

## 7. Ruxsatlar

| Rol | Ko‘rinish | Tanlash | Yozish |
|-----|-----------|---------|--------|
| OWNER / MANAGER | Ha | Ha | Ha |
| ACCOUNTANT | Ha | — | Ha |
| WAREHOUSE | — (faqat select uchun ro‘yxat) | Ha | Avtomatik (orqada) |
| SALES | — | — | — |

Yangi ruxsat **shart emas** — mavjudlar yetadi. WAREHOUSE roli daftarni ochiq ko‘rmaydi, lekin tanlash uchun ro‘yxat oladi (`/contacts/select` minimal ma’lumot bilan).

---

## 8. Bosqichlar

### 8.1 1-bosqich: qo‘lda kirim/chiqim (MVP)

- [ ] `PartnerLedgerLinkService` — `recordFromStockInbound`, `recordFromStockOutbound`.
- [ ] Yangi maydonlar va migration.
- [ ] `GET /partner-ledger/contacts/select` endpoint.
- [ ] Kirim/Chiqim modallariga select qo‘shish.
- [ ] Sinov: 5 ta harakat, 2 valyutada.

### 8.2 2-bosqich: Excel import

- [ ] Import wizard ga hamkor tanlash qadami.
- [ ] `ProductImportJob.partnerLedgerContactId` maydoni.
- [ ] Job yakunlanganda daftarga yig‘ma yozuv.
- [ ] Sinov: 100+ qatorli Excel.

### 8.3 3-bosqich: bekor qilish va manba havolasi

- [ ] `reverseBySource` ulanishi.
- [ ] Daftar UI da “Manba: ombor #123” havolasi.
- [ ] Ombor ro‘yxati da hamkor nomi.

### 8.4 4-bosqich (ixtiyoriy): B2B link

- [ ] `linkedPartnerId` UI da boshqarish.
- [ ] Qarz daftari va Hamkor daftari uchun **konsolidatsiya hisoboti**.

---

## 9. Risklar va qarama-qarshiliklar

| Risk | Yengillashtirish |
|------|------------------|
| Foydalanuvchi B2B va Hamkor daftarini chalkashtiradi | UI da aniq farqlash, “qo‘lda hisob” yorlig‘i |
| Excel duplikat yozuvi (qayta yuborilsa) | `sourceType + sourceId` unique tekshiruvi |
| Narx noto‘g‘ri → daftarda noto‘g‘ri summa | Modalda summa qo‘lda tahrirlanishi mumkin |
| Ombor harakati o‘chirilsa daftar “shishadi” | Teskari yozuv (tarix saqlanadi) |
| Bir vaqtda bir nechta valyuta | Har valyutaga alohida yozuv; UI ham shunday ko‘rsatadi |

---

## 10. Bog‘liq hujjatlar

- [02-products-warehouse.md](./02-products-warehouse.md) — Mahsulot, Variant, Stock, Excel import.
- [04-debts-workflow.md](./04-debts-workflow.md) — B2B qarz daftari (alohida domen).
- [12-code-maps-warehouse.md](./12-code-maps-warehouse.md) — Ombor kod yo‘llari.
- [partner-ledger.service.ts](../../apps/api/src/modules/partner-ledger/partner-ledger.service.ts) — Daftar servisi.

---

## 11. CHANGELOG kelishuvi

Implementatsiya boshlanganda har bosqichdan keyin [CHANGELOG.md](./CHANGELOG.md) ga qator qo‘shing:

```
| 2026-XX-XX | Ombor ↔ Hamkor daftari (qo‘lda) | §14, `partner-ledger-link.service.ts` |
```
