# Mahsulot oqimi xatoligi — chuqur tahlil (B2B qayta savdo)

Sana: 2026-05-28  
Qamrov: `apps/api` (B2B order -> dispatch -> goods receipt -> product mapping)

---

## 1) Muammo tavsifi

Kuzatilgan holat:

1. A sotuvchi mahsulotni B xaridorga sotadi.
2. Mahsulot B omboriga kiradi (kirim bo'ladi).
3. B keyin shu mahsulotni qayta sotadi.
4. A uni yana sotib olganda, A omboriga kirim "mavjud variantga qaytish" o'rniga ba'zi holatlarda "yangi mahsulot/variant" sifatida kirib qolmoqda.

Biznes nuqtai nazardan bu:
- katalogda duplikatga,
- "asl mahsulot izi" yo'qolishiga,
- hisobot va qoldiq kuzatuvida chalkashlikka olib keladi.

---

## 2) Reproduksiya (minimal ssenariy)

1. `A -> B` order yaratiladi, dispatch yuboriladi, `B` receipt accept qiladi.
2. `B` katalogida inbound uchun mapping yo'q bo'lsa, tizim `ensureBuyerVariantForInbound()` orqali mapping + variant yaratadi.
3. Keyin `B -> A` order qilinadi.
4. `A` receipt accept qilganda, reverse yo'nalishdagi mapping topilmasa, yana `ensureBuyerVariantForInbound()` yangi variant yaratishi mumkin.

Natija: A kompaniya katalogida shu mahsulotning yana bir "yangi" varianti paydo bo'ladi.

---

## 3) Root cause (kod darajasida)

### 3.1 Inbounddagi auto-create mantiqi

`goods-receipt-accept.service.ts` ichida har qator uchun:
- `processReceiptLineInbound()`
- `mappingsService.ensureBuyerVariantForInbound()`

chaqiriladi. Mapping aniq topilmasa, servis yangi `product`/`productVariant` yaratishga o'tadi.

### 3.2 Yo'nalishli mapping (directional mapping) cheklovi

Mapping `companyId + partnerCompanyId` kontekstida saqlanadi.  
`A -> B` uchun yaratilgan mapping avtomatik ravishda `B -> A` ga ko'chmaydi. Shu sabab reverse savdoda "oldindan bog'langan identity" yo'qoladi.

### 3.3 Snapshot/name drift sababli mos kelmaslik

`ensureBuyerVariantForInbound()` da fallback qidiruv:
- snapshot nomi,
- sku/barcode candidate,
- variant nomi
bo'yicha ketadi. Agar snapshot o'zgargan, nom formati farq qilgan yoki kodlar bir xil ulanmagan bo'lsa, mavjud variant topilmay, create branch ishlaydi.

### 3.4 Partner SKU semantics aralashishi

Kodda `partnerSku` ba'zan real SKU/barcode, ba'zan `sellerVariantId` (UUID) sifatida ishlatiladi. Bu mapping aniqligini pasaytiradi va reverse yo'nalishda stable bog'lanishni sustlashtiradi.

---

## 4) Ta'sir doirasi

- Bir mahsulot uchun bir kompaniya ichida ortiqcha variantlar paydo bo'lishi mumkin.
- Qayta savdo zanjirida "bir xil mahsulot" bir nechta kartochkaga bo'linib ketadi.
- Ombor qoldig'i, purchase/sale price izchilligi va report grouping noaniq bo'ladi.
- Foydalanuvchi "xuddi boshqa mahsulot kirib keldi" degan UX hissini oladi.

---

## 5) Tavsiya etilgan yechim (fix plan)

### P0 — Hotfix (tezkor)

1. `ensureBuyerVariantForInbound()` ichida create qilishdan oldin "strict reuse" qatlami qo'shish:
   - buyer company ichida sellerdan kelgan SKU/barcode lineage bo'yicha kuchli qidiruv;
   - topilsa hech qachon yangi product yaratmaslik.
2. `partnerSku` semantikasini ajratish:
   - `partnerSellerVariantId` (UUID) va
   - `partnerSkuCode` (biznes SKU)
   alohida saqlansin yoki kamida mappingda qat'iy normalizatsiya qilinsin.

### P1 — Structural fix

3. Cross-company product identity jadvali qo'shish (masalan, global product link):
   - bir mahsulotning A, B, C dagi variantlarini bitta identityga bog'lash.
4. Receipt accept paytida reverse mappingni ham auto-upsert qilish:
   - `A -> B` inbound bo'lganda kelajakdagi `B -> A` oqimi uchun mustahkam bog'lam tayyor bo'lsin.

### P2 — Data quality

5. Mavjud duplikat variantlarni aniqlash skripti:
   - nom + sku + barcode + savdo zanjiri bo'yicha candidate merge ro'yxati.
6. Admin merge tool/backoffice flow:
   - duplikat variantlarni birlashtirish va stock/historyni saqlab qolish.

---

## 6) Qabul mezoni (Done criteria)

- Round-trip savdo (`A -> B -> A`) da A tomonida yangi variant yaratilmasligi (mavjudiga bog'lanishi).
- Receipt qabulida create branch faqat haqiqatan yangi mahsulot bo'lsa ishlashi.
- Mapping aniqlashda UUID SKU aralashuvi regressiya testlari bilan yopilishi.
- Hisobotda bir mahsulot bo'yicha split trend keskin kamayishi.

---

## 7) Backlogga kiritilgan ishlar

1. **Critical**: B2B round-tripda reverse mapping sababli yangi variant yaratilishi (shu hujjatdagi root cause).  
2. **Critical**: `ensureBuyerVariantForInbound` create oldidan strict-reuse qatlamini qo'shish.  
3. **High**: Mapping modelida sellerVariantId va SKU semanticsni ajratish.  
4. **High**: Duplikat variantlarni aniqlash va merge rejasi.
