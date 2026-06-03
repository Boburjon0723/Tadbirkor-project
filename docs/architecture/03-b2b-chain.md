# B2B zanjiri (§11–16)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
11. Partner Module (Hamkorlik Moduli)

Kompaniyalar o‘rtasidagi hamkorlikni boshqaradi. B2B savdo-sotiq faqat ACTIVE hamkorlar orasida bo‘lishi mumkin.

11.1 Partner module vazifasi

- Kompaniyani STIR (TIN) orqali topish
- Hamkorlik so‘rovi yuborish
- So‘rovni qabul qilish / rad etish
- Hamkorlarni bloklash
- Hamkorlar ro‘yxatini ko‘rish
- Hamkor bilan balans / buyurtma / qarz tarixini ko‘rish

11.2 Database schema

Partner
- id, owner_company_id, partner_company_id, status, created_by, accepted_at, created_at, updated_at

11.3 Statuslar

- PENDING: So‘rov yuborilgan, javob kutilyapti.
- ACTIVE: Hamkorlik tasdiqlangan, B2B flow ruxsat etilgan.
- REJECTED: So‘rov rad etilgan.
- BLOCKED: Hamkorlik to‘xtatilgan, hech qanday B2B amal bajarib bo‘lmaydi.

11.4 API Endpoints

- GET /partners — Hamkorlar ro‘yxati
- GET /partners/search-company/:tin — Kompaniyani STIR orqali qidirish
- POST /partners/request — Hamkorlik so‘rovi yuborish
- POST /partners/:id/accept — So‘rovni tasdiqlash
- POST /partners/:id/reject — So‘rovni rad etish
- POST /partners/:id/block — Hamkorni bloklash
- GET /partners/:id — Hamkor haqida ma’lumot

11.5 Qoidalar va Edge Case'lar

- O‘z kompaniyasiga so‘rov yuborish mumkin emas.
- Bir vaqtda faqat bitta faol so‘rov yoki hamkorlik bo‘lishi mumkin (A->B bor bo‘lsa, B->A duplicate yaratilmaydi).
- BLOCKED bo‘lgan hamkor bilan buyurtma yaratish taqiqlanadi.
12. Product Mapping Module (Mahsulot Moslashtirish)

Bu B2B tizimning eng muhim qismlaridan biri. Har kompaniya o‘z mahsulotini alohida yuritadi. Hamkorlar orasida mahsulotlar ProductMapping orqali moslashtiriladi.

12.1 Product Mapping vazifasi

- Hamkor mahsuloti (nomi, SKU, barcode) → Mening ProductVariant'imga bog‘lash.
- O‘lchov birliklari va miqdorlarni konvertatsiya qilish (conversionRatio).
- Missing mappings: B2B order/receipt'da kelgan, lekin hali bog‘lanmagan mahsulotlarni aniqlash.

12.2 Database schema

ProductMapping
- id, company_id, partner_company_id, partner_product_name, partner_sku, partner_barcode, own_product_variant_id, conversion_ratio, unit_mapping, status, created_by, created_at, updated_at

12.3 Matching Priority (Ustuvorlik)

Tizim hamkor mahsulotini mening variantimga quyidagi tartibda qidiradi:
1. Barcode mosligi (eng ishonchli).
2. SKU mosligi.
3. Mahsulot nomi (aniq moslik).
4. Agar topilmasa: MAPPING_REQUIRED holati.

12.4 API Endpoints

- GET /product-mappings — Mavjud mappinglar
- GET /product-mappings/missing — Hali mapping qilinmagan mahsulotlar (orderlardan olingan)
- POST /product-mappings — Yangi mapping yaratish
- PATCH /product-mappings/:id — Mappingni tahrirlash
- DELETE /product-mappings/:id — Mappingni o‘chirish (yoki INACTIVE qilish)

12.5 Qoidalar

- Mapping faqat ACTIVE hamkorlar orasida bo‘ladi.
- Mapping bo‘lmasa, B2B receipt (tovar qabul qilish) yakunlanmaydi.
- Har kompaniya omborida faqat o‘z product_variant_id bo‘yicha qoldiq yuradi.
- A.Shakar 50kg → B.Shakar qop 50kg (Mapping orqali bog‘lanadi).
13. B2B Order Module (B2B Buyurtmalar)

Xaridor kompaniya hamkoriga buyurtma yuboradi. Bu tizimdagi biznes jarayonlarning boshlang‘ich nuqtasi bo‘lib, kelishuv qatlamini (agreement layer) ifodalaydi.

13.1 B2B Order vazifasi

- Xaridor (Buyer) → Sotuvchiga (Seller) buyurtma yuboradi.
- Sotuvchi buyurtmani qabul qiladi (Accept) yoki rad etadi (Reject).
- Order yaratilganda hali ombor qoldig‘i yoki qarz o‘zgarmaydi.
- Order item ichida `product_name_snapshot` saqlanadi, bu mahsulot nomi keyinchalik o‘zgarsa ham tarixni saqlab qolish uchun xizmat qiladi.

13.2 Database schema

B2BOrder
- id, buyer_company_id, seller_company_id, status, expected_delivery_date, note, created_by, created_at, updated_at

B2BOrderItem
- id, order_id, product_variant_id, product_name_snapshot, quantity, expected_price, mapping_status, created_at

13.3 Order Statuslar

- DRAFT: Buyurtma tayyorlanyapti.
- SENT: Sotuvchiga yuborildi.
- ACCEPTED: Sotuvchi tomonidan qabul qilindi.
- REJECTED: Sotuvchi tomonidan rad etildi.
- IN_PROGRESS: Tovar tayyorlanmoqda (Dispatch jarayoniga tayyorgarlik).
- DISPATCHED: Tovar yo‘lga chiqdi.
- RECEIVED: Xaridor tovarni qabul qilib oldi.
- COMPLETED: Jarayon to‘liq yakunlandi.
- CANCELLED: Buyurtma bekor qilindi.

13.4 Mapping Status (Order Item ichida)

- PENDING: Mapping hali tekshirilmagan.
- MAPPED: Mening katalogimda mahsulot topildi.
- REQUIRED: Mahsulot topilmadi, mapping qilish talab etiladi.

13.5 API Endpoints

Buyer:
- GET /b2b-orders, POST /b2b-orders, GET /b2b-orders/:id
- POST /b2b-orders/:id/send — Buyurtmani yuborish
- POST /b2b-orders/:id/cancel — Buyurtmani bekor qilish

Seller:
- GET /incoming-orders, GET /incoming-orders/:id
- POST /incoming-orders/:id/accept — Buyurtmani qabul qilish
- POST /incoming-orders/:id/reject — Buyurtmani rad etish

13.6 Qoidalar

- Faqat ACTIVE hamkorlar orasida order yaratish mumkin.
- Order accept qilinganda tizim avtomatik mahsulot mappingini tekshiradi.
- Mapping bo‘lmasa, status REQUIRED bo‘ladi va foydalanuvchidan mapping yaratish so‘raladi.

14. Dispatch Module (Jo‘natmalar)

Buyurtma asosida tovarni ombordan xaridorga jo‘natish jarayoni. Bu tizimdagi birinchi real ombor harakatini (Stock OUT) amalga oshiradi.

14.1 Dispatch vazifasi

- ACCEPTED holatidagi order asosida jo‘natma yaratish.
- Sotuvchi omborini tanlash va qoldiq yetarliligini tekshirish.
- Jo‘natma tasdiqlanganda (SENT) sotuvchi omboridan mahsulotlarni chiqim qilish (OUT).
- Xaridor tomonida PENDING Goods Receipt (tovar qabul qilish so‘rovi) yaratish.

14.2 Database schema

Dispatch
- id, dispatch_number, order_id, seller_company_id, buyer_company_id, warehouse_id, status, created_by, sent_at, created_at, updated_at

DispatchItem
- id, dispatch_id, product_variant_id, product_name_snapshot, quantity

14.3 Dispatch Statuslar

- DRAFT: Jo‘natma tayyorlanyapti.
- SENT: Tovar ombordan chiqdi va yo‘lga ketdi.
- CANCELLED: Jo‘natma bekor qilindi.

14.4 API Endpoints

- GET /dispatches — Jo‘natmalar ro‘yxati
- POST /dispatches — Yangi jo‘natma yaratish (DRAFT)
- GET /dispatches/:id — Jo‘natma detallari
- POST /dispatches/:id/send — Jo‘natmani tasdiqlash (Stock OUT + Receipt create)
- POST /dispatches/:id/cancel — Jo‘natmani bekor qilish

14.5 Qoidalar

- Faqat ACCEPTED holatidagi buyurtmalar uchun dispatch yaratish mumkin.
- Mapping REQUIRED bo‘lgan itemlar bor bo‘lsa, jo‘natish taqiqlanadi.
- Ombor qoldig‘i yetarli bo‘lmasa, jo‘natish (SENT qilish) mumkin emas.
- Jo‘natma SENT bo‘lganda, StockMovement (sourceType: DISPATCH) yaratiladi.
- Bitta buyurtma uchun (MVP'da) bitta to‘liq dispatch yaratiladi.

14. Invoice Module

Invoice B2B order asosida yoki alohida yaratilishi mumkin.

Invoice
- id
- invoice_number
- seller_company_id
- buyer_company_id
- order_id
- status
- total_amount
- currency
- note
- created_by
- created_at
- sent_at
- accepted_at
InvoiceItem
- id
- invoice_id
- seller_product_variant_id
- buyer_product_variant_id
- product_name_snapshot
- quantity
- unit
- price
- total
15. Dispatch Module

Sotuvchi tomonda tovar jo‘natishni boshqaradi.

Dispatch
- id
- dispatch_number
- seller_company_id
- buyer_company_id
- order_id
- invoice_id
- warehouse_id
- status
- created_by
- created_at
- sent_at

Dispatch qilinganda:

StockMovement:
company_id = seller_company_id
movement_type = OUT
source_type = DISPATCH
16. Goods Receipt Module (Tovar Qabul Qilish)

Sotuvchi jo‘natgan tovarni xaridor tomonidan qabul qilib olish jarayoni. Bu tizimdagi ikkinchi real ombor harakatini (Stock IN) va qarz (Debt Entry) yaratilishini ta’minlaydi.

16.1 Goods Receipt vazifasi

- Xaridorga kelgan jo‘natmani (Dispatch) ko‘rsatish.
- Tovarni qabul qilish (Accept), qisman qabul qilish (Partial Accept) yoki rad etish (Reject).
- Qabul qilinganda xaridor omboriga mahsulotlarni kirim qilish (Stock IN).
- Qabul qilingan miqdor asosida avtomatik qarz (Debt Entry) yaratish.

16.2 Database schema

GoodsReceipt
- id, order_id, dispatch_id, buyer_company_id, seller_company_id, status, received_at, created_at, updated_at

GoodsReceiptItem
- id, receipt_id, product_variant_id, product_name_snapshot, quantity (dispatched), received_quantity (actual)

16.3 Statuslar

- PENDING: Tovar yo‘lda, qabul qilish kutilmoqda.
- ACCEPTED: Tovar to‘liq qabul qilindi.
- PARTIALLY_ACCEPTED: Tovar qisman qabul qilindi.
- REJECTED: Tovar qabul qilinmadi (rad etildi).
- DISPUTED: Miqdor yoki sifat bo‘yicha e’tiroz bor.

16.4 API Endpoints

- GET /goods-receipts — Kelgan jo‘natmalar ro‘yxati
- GET /goods-receipts/:id — Qabul qilish detallari
- POST /goods-receipts/:id/accept — To‘liq qabul qilish
- POST /goods-receipts/:id/partial-accept — Qisman qabul qilish
- POST /goods-receipts/:id/reject — Qabulni rad etish

16.5 Qoidalar

- Faqat PENDING holatidagi receiptlarni qabul qilish mumkin.
- Qabul qilishdan oldin xaridor o‘z omborini tanlashi shart.
- Mapping REQUIRED bo‘lsa, qabul qilish bloklanadi (xaridor mapping yaratishi shart).
- Qabul qilinganda StockMovement (sourceType: GOODS_RECEIPT) yaratiladi.
- Qarz (Debt Entry) faqat qabul qilingan real miqdor uchun yaratiladi.
- Invoice yuborilishi qarz yaratilishiga asos bo‘lmaydi, faqat tovar qabul qilinganda qarz hisoblanadi.

16.6 Amalga oshirish (2026-05) — katta qabul va mapping

**Muammo:** 400+ qatorli qabulda bitta uzun tranzaksiya → Prisma `P2028` («Ma’lumotlar bazasi band»), frontend 503.

**Yechim (`goods-receipts.service.ts`):**

```text
loadReceiptForAccept()          # enrichsiz — tez yuklash
    ↓
prefillVariantCacheForAccept()  # har noyob sotuvchi variant — qisqa tx
    ↓
processReceiptAcceptChunk() × N # RECEIPT_ACCEPT_CHUNK_SIZE = 35
    ├── processReceiptLineInbound (variantCache hit)
    ├── recordGoodsReceiptInBatch (stock IN)
    └── applyInboundUnitCost (variant bo‘yicha dedupe)
    ↓
finalize tx                     # status, DebtEntry, order status
    ↓
assertInboundRecorded()
```

**Product mapping (`product-mappings.service.ts`):**

| Tartib | Kalit |
|--------|--------|
| 1 | `partnerSku` = sotuvchi **variant ID** |
| 2 | Sotuvchi SKU / barcode |
| 3 | Nom (faqat variant ID yo‘q bo‘lsa qattiq tekshiruv) |
| SKU qidiruv | Butun xaridor kompaniya katalogi (global) |
| Optimizatsiya | `prefetchedActiveMappings`, `prefetchedSellerVariant`, `buyerVariantsForSkuLookup` |

**Tranzaksiya:** `apps/api/src/prisma/transaction-options.ts` — `receiptAcceptTxOptions(lineCount)`.

**Frontend:** `AcceptReceiptModal`, `receipts.service.ts` — accept timeout 600s; preview SKU lar snapshotdan (xaridor katalogi emas).

