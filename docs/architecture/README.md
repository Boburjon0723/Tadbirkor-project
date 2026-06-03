# Axis ERP — Arxitektura hujjatlari

> **Oxirgi yangilanish:** 2026-05-25  
> Asosiy kirish nuqtasi. Batafsil matn bo‘limlarga bo‘lingan; `arxetektura.md` (loyiha ildizi) — qisqa indeks.

---

## Qanday foydalanish

| Kim | Nima o‘qish |
|-----|-------------|
| Yangi dasturchi | [00-overview](./00-overview.md) → [05-ui-api-events](./05-ui-api-events.md) → [10-deploy-auth](./10-deploy-auth.md) |
| Ombor / Excel | [02-products-warehouse](./02-products-warehouse.md) + [12-code-maps-warehouse](./12-code-maps-warehouse.md) + **[17-product-save-entry-flow](./17-product-save-entry-flow.md)** |
| POS / kassa | [06-pos-retail](./06-pos-retail.md) + [IMPLEMENTATION-POS-RETAIL.md](../../IMPLEMENTATION-POS-RETAIL.md) |
| Deploy | [10-deploy-auth](./10-deploy-auth.md) + [RAILWAY-SUPABASE-DATABASE.md](../RAILWAY-SUPABASE-DATABASE.md) |

**Qoida:** Kod yoki biznes qoidasi o‘zgarganda — tegishli bo‘lim faylini yangilang + [CHANGELOG.md](./CHANGELOG.md) ga bir qator qo‘shing.

---

## Bo‘limlar xaritasi

| Fayl | Mazmun (eski §) |
|------|------------------|
| [00-overview.md](./00-overview.md) | Loyiha maqsadi, konsept, arxitektura oqimi (§1–3) |
| [01-platform-core.md](./01-platform-core.md) | Company, User, Role, Module/Feature (§7–8) |
| [02-products-warehouse.md](./02-products-warehouse.md) | Product, Variant, Stock, **Excel import** (§9–10) |
| [03-b2b-chain.md](./03-b2b-chain.md) | Partner, Mapping, Order, Dispatch, Invoice, Receipt (§11–16) |
| [04-debts-workflow.md](./04-debts-workflow.md) | Qarz, Workflow, Notification, Audit (§17–20) |
| [05-ui-api-events.md](./05-ui-api-events.md) | Role UI, biznes flow, API, eventlar, MVP (§21–29) |
| [06-pos-retail.md](./06-pos-retail.md) | POS moduli, ombor scope (§30–31) |
| [07-implementation-status.md](./07-implementation-status.md) | Modullar bo‘yicha holat jadvali (§32) |
| [08-field-service.md](./08-field-service.md) | Dala xodimlari / FIELD_SERVICE (§33) |
| [09-frontend-modules.md](./09-frontend-modules.md) | Dinamik modul, sidebar (§34) |
| [10-deploy-auth.md](./10-deploy-auth.md) | Production, CORS, cookie, Railway/Vercel (§35) |
| [11-frontend-structure.md](./11-frontend-structure.md) | `apps/web` papkalar, B2B UI (§36–37) |
| [12-code-maps-warehouse.md](./12-code-maps-warehouse.md) | Ombor/inventar **kod yo‘llari** (§39) |
| [13-codebase-health.md](./13-codebase-health.md) | **Kod bazasi holati** va refaktor rejasi |
| [14-warehouse-partner-ledger.md](./14-warehouse-partner-ledger.md) | Ombor ↔ Hamkor daftari integratsiya rejasi |
| [99-strategic-summary.md](./99-strategic-summary.md) | MVP strategik xulosa |
| [CHANGELOG.md](./CHANGELOG.md) | O‘zgarishlar jurnali |

---

## Bog‘liq hujjatlar (loyiha ildizi)

| Fayl | Vazifa |
|------|--------|
| [arxetektura.md](../../arxetektura.md) | Qisqa indeks (ushbu papkaga havola) |
| [IMPLEMENTATION-POS-RETAIL.md](../../IMPLEMENTATION-POS-RETAIL.md) | POS implementatsiya checklist |
| [POS-SCANNER-ARXITEKTURA.md](../../POS-SCANNER-ARXITEKTURA.md) | Skaner / kassa texnik |
| [XATOLAR.MD](../../XATOLAR.MD) | Xavfsizlik audit |
| [docs/RAILWAY-SUPABASE-DATABASE.md](../RAILWAY-SUPABASE-DATABASE.md) | DB pooler :6543 |
| [docs/RAILWAY-REDIS.md](../RAILWAY-REDIS.md) | Redis + BullMQ |
| [docs/architecture-audit-2026-05-09.md](../architecture-audit-2026-05-09.md) | Audit xulosasi |

---

## Kod tuzilmasi (qisqa)

```text
apps/api/src/modules/     # NestJS — har biznes modul
apps/web/src/
  app/                    # Next.js route (ingichka page.tsx)
  features/<domain>/    # UI mantiq (inventory, pos, product-modal, …)
  services/               # API client
  hooks/                  # React Query
apps/api/prisma/          # Schema + migrations
```

**Maqsadli qoidalar:** `page.tsx` ingichka; API da modul bo‘yicha service; 800+ qatorli service → bo‘lish (keyingi refaktor).

---

## Keyingi hujjat ishleri

- [ ] Boshqa modullar uchun `12-code-maps-*.md` (orders, debts, pos)
- [ ] §36 ni haqiqiy `features/` ro‘yxati bilan yangilash
- [ ] Eski `architecture-changelog-2026-05-20.md` ni CHANGELOG ga birlashtirish
