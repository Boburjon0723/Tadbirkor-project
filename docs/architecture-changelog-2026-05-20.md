# Arxitektura o‘zgarishlari — 2026-05-20

Asosiy hujjat: [`arxetektura.md`](../arxetektura.md) (§30, §32, §34–§37 yangilangan).

## Yangi funksional

### POS + chakana
- `RetailCustomer`, `RetailReceivable`, `RetailReceivablePayment`
- POS checkout: `CASH` | `CREDIT`, mijoz strip, `Company.posCreditEnabled`
- Hisobot: `GET /reports/pos/*` — manba faqat `PosSale`

### API modullar
- `retail-customers/`, `retail-receivables/`, `reports/pos-reports.service.ts`

### Frontend
- `/dashboard/retail-customers`, `/dashboard/retail-receivables`, `/dashboard/reports/pos`
- `features/pos/PosCustomerStrip.tsx`
- Modul sidebar: `areModuleKeysEnabled`, `patchSessionFeatures`

## Oldingi sessiya (2026-05)

- JWT httpOnly cookie, CORS Vercel preview
- Modul yoqish/o‘chirish — refreshsiz sidebar
- `XATOLAR.MD` bo‘yicha xavfsizlik tuzatishlari
- Field Service, ombor scope, toast/confirm UI

## Migratsiya

```bash
cd apps/api
npx prisma migrate deploy
```

Fayl: `prisma/migrations/20260521120000_pos_retail_customers/`

## Keyingi reja

- POS narx override + PIN + audit
- `features/pos/*` komponent refactor

Batafsil: `IMPLEMENTATION-POS-RETAIL.md`
