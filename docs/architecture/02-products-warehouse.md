# Mahsulot va ombor (§9–10)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
9. Mahsulot modeli (Product Module)

Product module — butun tizimning poydevori. Ombor, B2B order, mapping, dispatch, receipt, debt — hammasi mahsulotga ulanadi.

9.1 Product module vazifasi

Product module quyidagiga javob beradi: Biz nimani sotamiz / olamiz / omborda yuritamiz?

U qiladi:
- Mahsulot yaratish
- Mahsulot variantlarini yaratish
- SKU / barcode yuritish
- Narx saqlash
- Kategoriya / birlik saqlash
- Mahsulotni aktiv/nofaol qilish
- B2B mapping uchun asos bo‘lish
- Ombor qoldig‘iga asos bo‘lish

U qilmaydi:
- ❌ Ombor qoldig‘ini bevosita o‘zgartirmaydi
- ❌ Buyurtma yaratmaydi
- ❌ Qarz yaratmaydi
- ❌ Hamkor bilan mappingni o‘zi hal qilmaydi

9.2 Asosiy qoida

Bizda oddiy Product yetmaydi. To‘g‘ri model: Product → ProductVariant → StockBalance

- Product = umumiy mahsulot nomi (masalan: Shakar, Futbolka)
- ProductVariant = real sotiladigan / omborda yuradigan birlik (masalan: Shakar 50kg, Futbolka Qora XL)
- StockBalance = aynan variant bo‘yicha qoldiq

Omborda qoldiq Product bo‘yicha emas, ProductVariant bo‘yicha yuradi.

9.3 Database schema

ProductCategory
- id, company_id, name, parent_id, status, created_at

Product
- id, company_id, name, category_id, description, **unit** (`dona` \| `kg` \| `l` \| `m` — default `dona`), type, status, created_by, created_at, updated_at, image_url

ProductVariant
- id, company_id, product_id, name, sku, barcode, attributes_json, sale_price, purchase_price, currency, status, created_by, created_at, updated_at

9.4 Product type & Status

Product Type (MVP):
- GOODS
- SERVICE
- RAW_MATERIAL (keyinchalik)
- FINISHED_GOOD (keyinchalik)

Statuslar:
- ACTIVE -> order va omborda ishlatiladi
- INACTIVE -> eski ma’lumotlarda ko‘rinadi, yangi orderda tanlanmaydi
- ARCHIVED -> UI’dan yashiriladi

9.5 Attributes modeli

Variantlar uchun attributes_json ishlatiladi. Masalan:
- Kiyim: {"rang": "Qora", "olcham": "XL"}
- Oziq-ovqat: {"qadoq": "50kg", "brend": "Baraka"}

9.6 API Endpoints

Categories:
- GET /product-categories, POST /product-categories, PATCH /product-categories/:id, DELETE /product-categories/:id

Products:
- GET /products, POST /products, GET /products/:id, PATCH /products/:id, DELETE /products/:id
- POST /products/import/preview, POST /products/import/confirm, GET /products/import/jobs/:jobId (Excel ombor katalogi — §10.7)

Product variants:
- GET /product-variants, GET /product-variants/:id, POST /products/:productId/variants, PATCH /product-variants/:id, DELETE /product-variants/:id
- GET /product-variants/search?query=&barcode=&sku=

10. Ombor modeli (Warehouse Module)

Warehouse module — mahsulotlarning jismoniy harakati va qoldig‘ini boshqaradi.

10.1 Warehouse module vazifasi

- Ombor yaratish
- ProductVariant bo‘yicha qoldiq yuritish
- StockMovement orqali kirim/chiqim qilish
- Qoldiqni ko‘rish
- Harakatlar tarixini ko‘rish
- Manual adjustment qilish

10.2 Eng muhim qoida

StockBalance hech qachon bevosita update qilinmaydi. Faqat StockMovement orqali o‘zgaradi.

10.3 Database schema

Warehouse
- id, company_id, name, address, status, created_at, updated_at

StockBalance
- id, company_id, warehouse_id, product_variant_id, **quantity** (`Decimal(15,4)`), **reserved_quantity** (`Decimal(15,4)`), updated_at

StockMovement
- id, company_id, warehouse_id, product_variant_id, type, **quantity** (`Decimal(15,4)`), source_type, source_id, created_by, note, created_at

**Migratsiya:** `20260523120000_stock_quantity_decimal` — o‘nlik qoldiq (kg/l/m) uchun.

10.4 Movement & Source turlari

Movement types:
- IN
- OUT
- ADJUSTMENT
- RESERVE
- UNRESERVE
- TRANSFER

Source types:
- MANUAL
- PRODUCT_INITIAL
- DISPATCH
- GOODS_RECEIPT
- ADJUSTMENT
- TRANSFER
- POS_SALE (kassa sotuvi — OUT)
- POS_VOID (kassa bekor qilish — IN)

10.5 API Endpoints

- GET /warehouses, POST /warehouses, GET /warehouses/:id, PATCH /warehouses/:id, DELETE /warehouses/:id
- GET /warehouses/:id/stock
- GET /stock-balances
- GET /stock-movements
- POST /stock-adjustments
- POST /stock-movements/in
- POST /stock-movements/out

10.6 Qoidalar

Sotuvchi jo‘natganda: seller stock OUT
Xaridor qabul qilganda: buyer stock IN
Qoldiq manfiy bo‘lib ketishi mumkin emas (sozlamaga qarab).

10.7 Excel ombor katalogi (import / export)

> **Holat:** **Amalga oshirilgan** (2026-05-25). Ustunlar, birlik, o‘nlik qoldiq, preview/confirm, export — production (Railway/Vercel). Batafsil: §10.9–§10.11.

Mahsulotlar katalogi (`/dashboard/inventory`) orqali ombor mahsulotlarini Excel bilan **eksport** qilish va **import** qilish. Bitta ustunlar formati (shablon = export = import fayli). UI da qator tanlash yo‘q — mantiq faqat Excel va import qoidalarida.

10.7.1 Majburiy ombor tanlash

| Amal | Ombor tanlash |
|------|----------------|
| **Excel eksport (qoldiq bilan)** | **Majburiy** — tanlanmagan bo‘lsa tugma blok / toast xato |
| **Excel eksport (qoldiqsiz)** | **Majburiy** |
| **Shablon yuklash** | Majburiy emas (bo‘sh namuna, barcha omborlar `Lookup` da) |
| **Import** | Fayldagi `Ombor Nomi` ustuni bo‘yicha; previewda tekshiriladi |
| **Katalog ro‘yxati** | Ombor tanlanguncha mahsulotlar ko‘rinmaydi (mavjud UX) |

Backend: `warehouseId` query parametri export endpointlarida **required**; yo‘q yoki noto‘g‘ri → `400 Bad Request`.

10.7.2 Ustunlar formati (split — 12 ustun + exportda Variant ID)

Barcha export turlari va import bir xil tartibda o‘qiladi (`product-import-excel.util.ts` → `productImportExcelColumns()`):

| Ustun | Sarlavha | Kalit | Izoh |
|-------|----------|--------|------|
| A | Mahsulot Nomi | `name` | Majburiy |
| B | SKU | `sku` | Ixtiyoriy; bir xil SKU = bir mahsulot |
| C | Shtrix-kod | `barcode` | Variant darajasida noyob |
| D | Rang | `color` | |
| E | Variant nomi | `variant` | L, XL va h.k. |
| F | Kirim Narxi | `purchasePrice` | |
| G | Sotuv Narxi | `salePrice` | `5.8` yoki `5,8` |
| H | Valyuta (UZS/USD) | `currency` | Faqat matn (raqam emas) |
| I | Boshlang‘ich Qoldiq | `initialStock` | `12,5` yoki `12.5` (§10.10) |
| J | Birlik (dona/kg/l/m) | `unit` | Bo‘sh → `dona` |
| K | Kategoriya | `categoryName` | `Ota > Bola` |
| L | Ombor Nomi | `warehouseName` | Lookup dropdown |
| M | Variant ID (import) | `variantId` | Faqat **eksport**da; qayta import uchun |

**Eski formatlar:** `Rangi/Varianti` bitta ustun (legacy) — parser avtomatik aniqlaydi (`detectProductImportExcelFormat`). Yangi shablonni ishlatish tavsiya etiladi.

Eski alohida «Hisobot» formati (8 ustun) **bekor** — bitta Excel oqimi.

10.7.3 Ikki xil eksport

| Tur | UI nomi | `initialStock` ustuni | Maqsad |
|-----|---------|------------------------|--------|
| **Miqdorli** | Excel (qoldiq bilan) | Joriy `StockBalance.quantity` yoziladi | Inventarizatsiya, qoldiq tuzatish, round-trip |
| **Miqdorsiz** | Excel (qoldiqsiz) | **Bo‘sh** (yoki `-`) | Faqat narx, nom, kategoriya; **zaxiraga tegilmaydi** |
| **Shablon** | Shablon | Misol qatorlar | Yangi korxona / yangi mahsulot kiritish |

API (Reports):

- `GET /reports/templates/products` — bo‘sh shablon (+ Yoriqnoma, Lookup)
- `GET /reports/export/products-import-format?warehouseId={id}&mode=with_stock|without_stock` — tanlangan ombor mahsulotlari
- Eski `GET /reports/export/stock` — deprecate / ichki analytics uchun saqlanishi mumkin, katalog UI dan olib tashlanadi

10.7.4 Import oqimi (UI tanlovsiz)

```
Ombor tanlash → Excel eksport (miqdorli) → Excelda tahrir → Import fayl → Preview → Tasdiqlash
```

**Preview** (`POST /products/import/preview`):

- Fayl ustunlari shablon bilan mos kelishi shart
- `Ombor Nomi` → `warehouseId` resolve
- Mavjud barkod → **Yangilash** (xato emas)
- Yangi barkod → **Yangi**
- Statistika: `yangi | yangilash | o‘tkazildi | xato`

**Tasdiqlash** (`POST /products/import/confirm`):

Body: `{ rows, importMode, stockPolicy }`

| Parametr | Qiymatlar | Default |
|----------|-----------|---------|
| `importMode` | `set` \| `add` \| `subtract` | `set` |
| `stockPolicy` | `skip_zero_and_unchanged` \| `apply_all` | `skip_zero_and_unchanged` |

10.7.5 Zaxira (qoldiq) qoidalari — `stockPolicy: skip_zero_and_unchanged`

Faqat **miqdorli** fayl importida zaxira yangilanadi. **Miqdorsiz** faylda `initialStock` **hech qachon** o‘qilmaydi.

| Holat | Zaxira harakati |
|--------|-----------------|
| Mavjud mahsulot, Excel qoldiq **0 yoki bo‘sh** | **O‘tkazib yuborish** (bazadagi qoldiq saqlanadi) |
| Mavjud mahsulot, Excel qoldiq = bazadagi qoldiq | **O‘tkazib yuborish** (o‘zgarmagan) |
| Mavjud mahsulot, Excel qoldiq o‘zgargan va **> 0** | `importMode` bo‘yicha yangilash |
| Yangi mahsulot, qoldiq 0 yoki bo‘sh | Mahsulot yaratiladi, zaxira 0 yoki qator o‘tkaziladi (siyosat: faqat qoldiq > 0 bo‘lsa IN) |
| Yangi mahsulot, qoldiq > 0 | Yaratish + boshlang‘ich qoldiq |

`importMode` (faqat zaxiraga tegadigan qatorlarda):

| Rejim | Formula (mavjud qoldiq = B, Excel = E) |
|-------|------------------------------------------|
| `set` | Yangi qoldiq = **E** |
| `add` | Yangi qoldiq = **B + E** |
| `subtract` | Yangi qoldiq = **max(0, B − E)** |

Har zaxira o‘zgarishi `StockService.adjustStock` yoki ekvivalent `StockMovement` (`sourceType: ADJUSTMENT`, `stock.adjusted` audit) orqali — bevosita `StockBalance` patch emas.

10.7.6 Narx va katalog maydonlari

| Maydon | Mavjud mahsulot | Yangi mahsulot |
|--------|-----------------|----------------|
| `salePrice`, `purchasePrice`, `currency` | Yangilash (Excelda o‘zgarganda) | Yaratishda yoziladi |
| `unit` | Yangilash (J ustun to‘ldirilsa) | Default `dona` |
| `name`, `variant`, `categoryName` | Yangilash mumkin | Yaratishda |
| `barcode` | O‘zgartirish taqiqlanadi (identifikator) | Yangi unique |

10.7.7 Chekka holatlar

- Exceldan qator **o‘chirilgan** — bazadagi mahsulot **o‘chirilmaydi** (faqat e’tiborsiz).
- Qoldiqni **0 ga tushirish** ataylab: hozir `skip_zero` tufayli ishlamaydi; kelajakda `importMode: set` + maxsus belgi yoki alohida «ombordan chiqarish» oqimi.
- Bir faylda bir nechta ombor nomi: preview xato yoki faqat tanlangan ombor qatorlari (tavsiya: export faqat bitta ombor, importda `warehouseName` mos kelishi shart).
- Takror barkod fayl ichida: xato.
- Import fon rejimi: `ProductImportJob` (mavjud) — 400+ qator uchun.

10.7.8 Frontend (Mahsulotlar katalogi)

| Tugma | Harakat |
|--------|---------|
| Shablon | Bo‘sh fayl |
| Excel (qoldiq bilan) | `warehouseId` majburiy → export |
| Excel (qoldiqsiz) | `warehouseId` majburiy → export |
| Import | Modal: fayl + preview + rejim (`set/add/subtract`) matni |
| ~~Hisobot~~ | Olib tashlanadi (vazifasi «qoldiq bilan» exportda) |

Import modalida **qator checkbox yo‘q** — faqat statistika va `importMode` tanlovi (3 ta radio).

10.7.9 Bog‘liq API (Products)

- `POST /products/import/preview`
- `POST /products/import/confirm` → `{ jobId }` (async)
- `GET /products/import/jobs/:jobId`

**Import UI ombor:** Inventarda tanlangan ombor ishlatiladi; Excel `L` ustunidagi nom e’tiborsiz qoldirilishi mumkin (previewda `warehouseHint`).

10.7.10 O‘lchov birligi (`Product.unit`)

| Kod | Ko‘rinish | Qoldiq qoidasi |
|-----|-----------|----------------|
| `dona` | dona (default) | Faqat **butun son** (5, 10) |
| `kg` | kilogramm | O‘nlik (2.5, 12,75) |
| `l` | litr | O‘nlik |
| `m` | metr | O‘nlik |

**Sinonimlar (import):** `litr`→`l`, `metr`→`m`, `ta`→`dona` — `normalizeProductUnit()` (`product-import-excel.util.ts`, `common/units/product-unit.util.ts`).

**UI:** `ProductModalBasicSection` — birlik tanlash; `InventoryProductsTable` — `formatStockQuantity()` (`lib/product-units.ts`).

**Backend validatsiya:** `StockService.recordMovement` va batch operatsiyalar `validateStockQuantity()` chaqiradi — `dona` uchun `2.5` → `400 Bad Request`.

10.7.11 Excel qoldiq: vergul va nuqta

`parseExcelDecimalCell()` — I ustun:

- Excel ichki raqam: `1.23`
- Matn: `12,5`, `12.5`, `1 234,56` (EU/US ajratish)
- `dona` + o‘nlik → preview **xato**; `kg`/`l`/`m` + o‘nlik → saqlanadi

**Muhim:** O‘nlik qoldiq uchun **J ustunda** `kg`, `l` yoki `m` bo‘lishi shart; bo‘sh qoldirilsa `dona` deb olinadi va `1,23` → `1` ga yaxlitlanadi.

10.7.12 Inventar katalogi — performance va realtime

| Mavzu | Implementatsiya |
|-------|-----------------|
| Yengil ro‘yxat | `GET /products?view=catalog` — kam maydon, 1-sahifada `summary` |
| Frontend | `keepPreviousData`, alohida summary so‘rovi olib tashlangan |
| Realtime | Socket `inventory:changed` → `use-inventory-realtime.ts`, `use-company-realtime.ts` |
| Gateway | `inventory.gateway.ts` — `emitDebtsChanged` / `debts:changed` (qarz sahifasi) |

10.8 Excel ombor — implementatsiya rejasi

| Bosqich | Vazifa | Holat |
|---------|--------|--------|
| **1** | `arxetektura.md` §10.7 | ✅ |
| **2** | Export `with_stock\|without_stock`, `warehouseId` required | ✅ |
| **3** | UI: export tugmalari, ombor majburiy | ✅ |
| **4** | Preview: `rowAction`, `skip_zero_and_unchanged` | ✅ |
| **5** | Confirm + `ProductImportJob` (async) | ✅ |
| **6** | Import modal + qo‘llanma (`product-import-guide.ts`) | ✅ |
| **7** | Birlik ustuni + o‘nlik qoldiq + `Decimal` migratsiya | ✅ (2026-05-25) |
| **8** | Katalog `view=catalog` + realtime | ✅ |
| **9** | QA: round-trip export → import | Foydalanuvchi tekshiruvi |

**Tekshiruvlar (acceptance):**

1. Ombor tanlanmasdan export — xato, fayl yuklanmaydi.
2. Miqdorli export — har qatorda joriy qoldiq ko‘rinadi.
3. Miqdorsiz export — qoldiq ustuni bo‘sh; importdan keyin zaxira o‘zgarmaydi.
4. 443 ta qoldiq o‘zgartirilmagan, 10 ta tahrir — importda 10 ta `StockMovement`.
5. Excel qoldiq 0 — mavjud mahsulot zaxirasiga tegilmaydi.
6. `importMode: add` — faqat o‘zgargan qatorlarda `B + E`.

