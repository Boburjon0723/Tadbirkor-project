# POS + Chakana mijozlar — implementatsiya rejasi

> Arxitektura hujjati: [`arxetektura.md`](./arxetektura.md) — §30, §34–§37

## Maqsad
- Hisob-kitob **faqat** `PosSale` / `PosSaleItem` dan (stock OUT emas).
- Chakana mijozlar va nasiya **B2B Debt** dan alohida.
- Barcha yangi UI **POS moduli** ostida (yoqish/o‘chirish).
- `posCreditEnabled` — kompaniya sozlamasida nasiya.

## Bosqichlar

| # | Vazifa | Holat |
|---|--------|--------|
| 1 | Prisma: `RetailCustomer`, `RetailReceivable`, `PosSale` kengaytirish | ✅ |
| 2 | API: `retail-customers`, `retail-receivables` | ✅ |
| 3 | API: `GET /reports/pos/summary` | ✅ |
| 4 | POS checkout: mijoz + `CREDIT` + receivable | ✅ |
| 5 | Web: services, sahifalar, sidebar | ✅ |
| 6 | Web: `features/pos/*` refactor (page ingichka) | ✅ |
| 7 | Narx kelishish + permission + audit | ✅ |
| 8 | **UX qayta tuzish:** POS markazi (3 tab) | ✅ |

## Fayl struktura (web)

```
features/pos/           — kassa komponentlari
features/retail-customers/
features/retail-receivables/
app/dashboard/retail-customers/
app/dashboard/retail-receivables/
app/dashboard/reports/pos/
```

## Fayl struktura (api)

```
modules/retail-customers/
modules/retail-receivables/
modules/reports/pos-reports.service.ts
```

## Modul qoidalari
- Sidebar: `moduleKeys: ['POS']`
- Mijozlar qarzi: `posCreditEnabled === true`
- API: `CompaniesService.assertModuleEnabled(companyId, 'POS')`
