# Axis ERP — Arxitektura (indeks)

> **Oxirgi yangilanish:** 2026-05-25  
> To‘liq hujjatlar endi **`docs/architecture/`** papkasida. Ushbu fayl — tez navigatsiya.

---

## Asosiy hujjatlar

| Bo‘lim | Fayl |
|--------|------|
| **Barcha bo‘limlar (TOC)** | [docs/architecture/README.md](docs/architecture/README.md) |
| Umumiy ko‘rinish | [docs/architecture/00-overview.md](docs/architecture/00-overview.md) |
| Mahsulot va ombor (Excel, birlik, qoldiq) | [docs/architecture/02-products-warehouse.md](docs/architecture/02-products-warehouse.md) |
| B2B zanjiri | [docs/architecture/03-b2b-chain.md](docs/architecture/03-b2b-chain.md) |
| Qarz daftari | [docs/architecture/04-debts-workflow.md](docs/architecture/04-debts-workflow.md) |
| POS / chakana | [docs/architecture/06-pos-retail.md](docs/architecture/06-pos-retail.md) |
| Production deploy | [docs/architecture/10-deploy-auth.md](docs/architecture/10-deploy-auth.md) |
| Ombor kod xaritasi | [docs/architecture/12-code-maps-warehouse.md](docs/architecture/12-code-maps-warehouse.md) |
| Kod bazasi holati | [docs/architecture/13-codebase-health.md](docs/architecture/13-codebase-health.md) |
| O‘zgarishlar jurnali | [docs/architecture/CHANGELOG.md](docs/architecture/CHANGELOG.md) |

---

## Tezkor havolalar

- Railway + Supabase: [docs/RAILWAY-SUPABASE-DATABASE.md](docs/RAILWAY-SUPABASE-DATABASE.md)
- Redis: [docs/RAILWAY-REDIS.md](docs/RAILWAY-REDIS.md)
- POS implementatsiya: [IMPLEMENTATION-POS-RETAIL.md](IMPLEMENTATION-POS-RETAIL.md)
- Xavfsizlik: [XATOLAR.MD](XATOLAR.MD)

---

## Loyiha tuzilmasi

```text
Tadbirkor/
├── arxetektura.md              ← siz shu yerda (indeks)
├── docs/architecture/          ← to‘liq arxitektura bo‘limlari
├── apps/api/                   ← NestJS API
├── apps/web/                   ← Next.js frontend
└── mobile/                     ← Expo (alohida)
```

**Eslatma:** `ARCHITECTURE.md` alohida fayl ishlatilmaydi — mazmun `docs/architecture/` da.
