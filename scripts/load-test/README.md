# Load test (hatest)

Oddiy yuk testi — mahsulotlar ro‘yxati, ombor qoldiqlari va picking endpointlarini parallel tekshiradi.

## Tayyorgarlik

1. API ishlab tursin (`apps/api`: `npm run start:dev`)
2. Web orqali login qiling va JWT oling (DevTools → Application → `axis_access_token` yoki Network → Authorization header)

## Ishga tushirish

```powershell
$env:LOAD_TEST_TOKEN="eyJ..."
$env:LOAD_TEST_BASE_URL="http://localhost:4002/api"
$env:LOAD_TEST_WAREHOUSE_ID="your-warehouse-uuid"
$env:LOAD_TEST_CONCURRENCY="15"
$env:LOAD_TEST_DURATION_SEC="45"
node scripts/load-test/load-test.mjs
```

## Excel import tezligi

Import optimizatsiyasi uchun API `.env` da (ixtiyoriy):

```
IMPORT_BATCH_SIZE=40
IMPORT_ROW_TX_BATCH_SIZE=25
IMPORT_SYNC_MAX_ROWS=250
```

- **≤250 qator** — sinxron import (darhol javob)
- **>250 qator** — BullMQ navbat (Redis kerak)

## K6 (ixtiyoriy)

K6 o‘rnatilgan bo‘lsa, `k6 run scripts/load-test/k6-inventory.js` ishlatishingiz mumkin.
