# Telegram E2E Checklist

## Pre-setup
- [ ] Railway env:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_BOT_USERNAME` (`@` belgisiz)
  - `TELEGRAM_WEBHOOK_URL` = `https://<backend>/api/telegram/webhook`
  - `TELEGRAM_WEBHOOK_SECRET` = random string
  - `TELEGRAM_UPDATES_ENABLED=false`
- [ ] `Settings -> Telegram ulash` orqali kompaniya chati ulangan (`ULANGAN`).
- [ ] `Settings -> Telegram routing` bo‘limida role/module mapping kamida 1 ta yaratilgan.

## 1) B2B order flow
- [ ] Buyer kompaniya `order sent` qilganda Seller chatiga xabar kelsin.
- [ ] Xabarda `Qabul qilish`/`Bekor qilish` tugmalari chiqsin.
- [ ] Tugma bosilganda order status backendda yangilansin (`ACCEPTED` yoki `REJECTED`).
- [ ] `audit_logs`da `order.*.telegram` actionlari paydo bo‘lsin.

## 2) Partner request flow
- [ ] Partner request yaratilganda qabul qiluvchi kompaniya chatiga xabar borsin.
- [ ] `Qabul qilish`/`Bekor qilish` tugmasi bilan request statusi o‘zgarsin.
- [ ] `audit_logs`da `partner.accepted.telegram` yoki `partner.rejected.telegram` yozilsin.

## 3) Debt/payment flow
- [ ] Debtor `payment record` yaratsa creditor chatiga warning xabar kelsin.
- [ ] `Qabul qilish` bosilganda payment `CONFIRMED` bo‘lsin.
- [ ] `Bekor qilish` bosilganda payment `REJECTED` bo‘lsin.
- [ ] Confirm holatda `debtEntry.remainingAmount` kamayishi tekshirilsin.
- [ ] `audit_logs`da `debt.payment_*.telegram` actionlari yozilsin.

## 4) Warehouse/dispatch/receipt flow
- [ ] Dispatch `SENT` bo‘lganda buyer tomonga Telegram xabar borsin.
- [ ] Receipt `ACCEPTED` va `PARTIALLY_ACCEPTED` bo‘lganda seller tomonga xabar borsin.
- [ ] Xabarda `details` maydonlari (ID/status/amount) ko‘rinsin.

## 6) Multi-currency + pricing flow
- [ ] Buyer order yaratishda item valyutasi (`UZS`/`USD`) tanlansin.
- [ ] Product name bo‘yicha `Auto` narx tugmasi seller `salePrice` + `currency` ni olib kelsin.
- [ ] Seller incoming mappingda narxni qo‘lda kirita olsin (kiritilmasa auto `salePrice` ishlasin).
- [ ] Dispatch -> Receipt -> Debt zanjirida aynan kelishilgan narx/valyuta saqlansin.
- [ ] Debt list sahifasida summa valyutaga mos formatda ko‘rinsin.

## 7) Warehouse-specific visibility + binding
- [ ] Yangi ombor yaratishda ustun togglelari (rasm/tavsif/SKU/barkod/rang/kirim/sotuv) saqlansin.
- [ ] Mavjud ombor uchun `Ustun sozlamasi` orqali config tahrir qilinsin.
- [ ] Tanlangan omborda faqat shu omborga biriktirilgan mahsulotlar ko‘rinsin.
- [ ] `Initial stock = 0` bo‘lsa ham `warehouse binding` saqlansin va ro‘yxatda ko‘rinsin.

## 8) Variant color constraints
- [ ] Bir mahsulot ichida rang takrorlanmasligi backend tomonidan bloklansin.
- [ ] Frontendda save oldidan rang duplicate bo‘lsa ogohlantirish chiqsin.

## 5) Security/idempotency
- [ ] Bir action tugmasini ketma-ket bir necha marta bossangiz, birinchi bosishdan keyin qayta ishlash bo‘lmasin.
- [ ] Noto‘g‘ri webhook secret bilan request yuborilganda `401` qaytsin.
- [ ] Boshqa chatdan eski callback data qayta yuborilganda action bajarilmasin.
