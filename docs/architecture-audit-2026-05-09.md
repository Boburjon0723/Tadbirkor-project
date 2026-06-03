# Loyiha Arxitektura Auditi va O'zgarishlar Hisoboti (2026-05-09)

## 1) Audit maqsadi

Ushbu hujjat quyidagilarni tekshiradi:
- `arxetektura.md` dagi modular monolith va MVP chegarasiga moslik;
- so'nggi yangilangan funksiyalar ro'yxati;
- rejadan tashqari (scope creep) o'zgarishlar bor-yo'qligi.

## 2) Arxitekturaga moslik tekshiruvi

`arxetektura.md` bo'yicha asosiy yo'nalishlar:
- Stack: NestJS + Prisma + PostgreSQL, Next.js frontend.
- Modular monolith: product, warehouse, b2b-order, reports, debts, dispatch, goods-receipt.
- Queue/async event yo'nalishi: Redis + BullMQ tavsiya etilgan.
- MVP markazi: Product/Variant, Warehouse, B2B order flow, mapping, debt.

Natija:
- O'zgarishlar asosan mavjud modullar ichida qilingan, yangi servisga ajratilmagan.
- Queue asosidagi import (`BullMQ + Redis`) arxitektura hujjatidagi tavsiya bilan mos.
- B2B, Product, Warehouse, Reports oqimlarida kiritilgan o'zgarishlar MVP doirasidan chiqmaydi.

## 3) Yangilangan funksiyalar (modul kesimida)

### 3.1 Product / Inventory
- `ProductModal` variant UI tekislandi (grid, input accessibility, fokus holatlari).
- `Barcode` input varianta qo'shildi.
- `SKU` ko'rinishi barcha variantlarda yaxshilandi (UI consistency).
- Kategoriya yaratishda ombor biriktirish qo'shildi.
- Kategoriya o'chirish UI qo'shildi (`CategoryModal` ichida).
- Product delete oqimi FK-safe qilindi: bog'langan yozuvlar bo'lsa archive fallback.

### 3.2 Categories
- Category modelga `warehouseId` qo'shildi.
- Create/Update da warehouse validatsiyasi qo'shildi.
- Category list API `warehouse` relation bilan qaytaradi.

### 3.3 Import (Excel)
- Template kengaytirildi:
  - `Kategoriya` ustuni;
  - `Valyuta (UZS/USD)` ustuni;
  - dropdown validationlar;
  - yoriqnoma varag'i.
- Parser kengaytirildi:
  - bo'sh qatorlarni tashlab yuborish;
  - valyuta validatsiyasi;
  - kategoriya path (`Ota > Bola`) auto-create/bind;
  - SKU qayta kelganda bir mahsulotning varianti sifatida qayta ishlash.

### 3.4 Import tezlik va barqarorlik
- Async import infrastruktura qo'shildi:
  - `ProductImportJob`, `ProductImportStagingRow` jadvallari;
  - enqueue + worker oqimi;
  - frontend polling progress.
- Batchlash:
  - stagingga `createMany`;
  - workerda batch processing + fallback.
- Transaction barqarorligi:
  - kichik chunklar;
  - transient `P2028` uchun retry.

### 3.5 B2B Orders
- UI'da buyurtmani bekor qilish tugmalari qo'shildi.
- Buyurtmani to'liq o'chirish funksiyasi qo'shildi:
  - `DELETE /b2b-orders/:id`;
  - status va bog'liq hujjatlar bo'yicha cheklovlar.
- Seller katalog querysi qoldiq bo'yicha cheklab qo'yildi (`quantity > 0`).

## 4) Rejadan tashqari chiqish (scope creep) tekshiruvi

### 4.1 Katta arxitektura darajasida
- Yangi mikroservis yoki arxitektura ajratish qilinmagan.
- Mavjud modul chegaralari saqlangan.
- Queue qo'shilishi hujjatdagi tavsiya bilan mos, rejadan tashqari emas.

### 4.2 Funksional darajada
- Buyurtmani "cancel"dan tashqari "delete" qo'shilgan:
  - B2B order lifecycle doirasida qoladi;
  - ammo API kontrakt kengaygan (hujjatga endpoint qo'shilishi tavsiya etiladi).
- Import tizimida job/staging jadvallari qo'shilgan:
  - operational ehtiyoj va barqarorlik uchun asosli;
  - data model hujjatlarida aks ettirish kerak.

Xulosa:
- Kritic scope creep aniqlanmadi.
- O'zgarishlar MVP oqimini kuchaytiruvchi va ishlab chiqarish muammolarini yopuvchi xarakterda.

## 5) Aniqlangan amaliy muammolar va holat

- Ayrim deploylarda eski `dist` ishlagan (yangi kod qo'llanmagan).
- `npm ci` lockfile mismatch holati yuz bergan.
- DB migrationlar to'liq qo'llanmasa yangi funksiyalar ishlamaydi.

## 6) Tavsiya etilgan yakuniy checklist

1. `apps/api` bo'yicha lockfile va dependencies sync holatda ekanini tasdiqlash.
2. Prisma migrationlarni productionga to'liq qo'llash:
   - `ProductCategory.warehouseId`
   - `ProductImportJob`
   - `ProductImportStagingRow`
3. Railway root/directory sozlamalarini tekshirish (`apps/api`).
4. `REDIS_URL` env borligini tekshirish.
5. Arxitektura hujjatini yangilash (`docs/architecture/`, [README](./architecture/README.md)):
   - B2B order `DELETE` endpointi;
   - Import job/staging data model.

## 7) Umumiy xulosa

Loyiha o'zgarishlari modular monolith arxitekturasiga mos holda bajarilgan.
Asosiy yo'nalishlardan chiqilmagan.
Kiritilgan yangilanishlar ko'proq:
- UX/UI sifatini,
- import barqarorligi va throughput'ni,
- B2B operatsion boshqaruvni
yaxshilashga qaratilgan.
