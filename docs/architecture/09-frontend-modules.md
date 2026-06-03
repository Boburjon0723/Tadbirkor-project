# Modul tizimi va UI (§34)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 34. Modul tizimi va dinamik UI (frontend)

### 34.1 Backend: Module / Feature

- `Module` + `Feature` + `CompanyFeature` (Prisma).
- `CompaniesService.getFeatureConfig()` → `hasFeatureConfig`, `enabledModules`, `enabledFeatures`.
- `updateFeatureConfig({ moduleKey, enabled })` — Sozlamalar → Modullar.
- `assertModuleEnabled(companyId, moduleKey)` — API darajasida himoya (retail-*, POS).

**Modul kalitlari (asosiy):** WAREHOUSE, B2B, PARTNERS, PRODUCT_MAPPING, DEBT, POS, EMPLOYEES, FIELD_SERVICE, STOREFRONT, EXPENSES, REPORTS, INTEGRATIONS.

### 34.2 Frontend: session va sidebar

```text
useSession() → auth/me + companies/features (React Query, stale ~10 min)
       ↓
dashboard/layout.tsx → shouldShowByFeature(item)
       ↓
areModuleKeysEnabled(cfg, moduleKeys, match)
```

| Menyu | moduleKeys | match |
|-------|------------|-------|
| Hamkorlar | `['PARTNERS']` | all |
| Mahsulot Mapping | `['PRODUCT_MAPPING']` | all |
| Kelgan yuklar | `['WAREHOUSE','B2B']` | any |
| B2B Buyurtmalar | `['B2B']` | all |

**Modul o‘zgartirilganda:** `patchSessionFeatures()` (`lib/session-cache.ts`) — sidebar refreshsiz yangilanadi.

**Sahifa himoyasi:** `ModuleGate` — o‘chirilgan modul URL ga kirilsa blok xabari.

### 34.3 POS “quti” prinsipi

Barcha chakana funksiyalar **bitta `POS` moduli** ostida; alohida top-level modul emas.

- `posCreditEnabled` (Company) — nasiya va «Mijozlar qarzi» UI.
- B2B `DEBT` moduli chakana qarz bilan aralashmaydi.

---

