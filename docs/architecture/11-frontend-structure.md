# Frontend struktura (§36–37)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 36. Frontend papka strukturasi (2026-05-20)

```text
apps/web/src/
├── app/                         # Next.js App Router (route only)
│   ├── pos/page.tsx
│   └── dashboard/
│       ├── inventory/page.tsx
│       ├── debts/page.tsx
│       ├── orders/page.tsx
│       ├── receipts/page.tsx
│       └── … (24 ta sahifa)
├── features/                    # Domain UI (asosiy mantiq shu yerda)
│   ├── inventory/               # jadval, toolbar, header, utils
│   ├── product-modal/           # ProductModal, variant kartochkalar
│   ├── pos/                     # savat, checkout
│   ├── pos-center/
│   ├── orders/                  # B2B buyurtmalar UI
│   ├── receipts/
│   ├── reports/
│   └── create-order/
├── components/                  # Umumiy UI + re-export
│   ├── ProductModal.tsx         → features/product-modal
│   ├── ImportProductModal.tsx
│   ├── ModuleGate, ConfirmDialog, …
├── hooks/
│   ├── products/use-products.ts
│   ├── inventory/use-inventory-realtime.ts
│   ├── debts/use-debts-realtime.ts
│   ├── warehouse/use-warehouse.ts
│   └── pos/use-pos.ts
├── services/                    # API client (*.service.ts)
└── lib/
    ├── feature-modules.ts
    ├── product-units.ts
    ├── product-import-guide.ts
    └── session-cache.ts
```

**Qoidalar:**

| Qatlam | Vazifa |
|--------|--------|
| `app/**/page.tsx` | Route, layout, feature komponentlarni ulash (≤ ~150 qator maqsad) |
| `features/<domain>/` | Jadval, modal, form, domain utils |
| `components/` | Ko‘p domainda ishlatiladigan UI; domain → `features/` ga ko‘chirish |
| `hooks/` + `services/` | Server holat va API |

**Dashboard sahifalar:** `inventory`, `debts`, `orders`, `receipts`, `partners`, `product-mappings`, `warehouse`, `pos`, `reports`, `field`, `settings`, …

---

## 37. B2B buyurtmalar — katta hajm va UI (2026-05)

| Mavzu | Kod / env |
|-------|-----------|
| Qator limiti | `B2B_ORDER_MAX_LINE_ITEMS` (API env, default 500, max 2000) |
| Katta `findOne` | 80+ qator → `itemsPaginated` + `GET /b2b-orders/:id/items` |
| UI guruhlash | `orders-utils.ts`, `OrdersPartnerDrawer`, hamkor bo‘yicha jadval |
| Modal z-index | `OrderDetailsModal` z-[140], dispatch z-[145] |
| PDF akt sverka | `partner-balance-pdf.util.ts` — **pdfmake** (Chrome shart emas) |

---

