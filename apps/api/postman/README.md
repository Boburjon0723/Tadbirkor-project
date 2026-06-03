# Postman — API test

## Import

1. Postman → **Import** → `Tadbirkor-local.postman_environment.json` + `Tadbirkor-pagination.postman_collection.json`
2. Environment: **Tadbirkor Local** tanlang
3. `login` / `password` ni o‘z hisobingizga qo‘ying (oddiy matn, `{{` siz)
4. Login Body da faqat `{{login}}` va `{{password}}` ishlating — `{{Zero0723s}}` kabi nomlar **ishlamaydi**
4. `baseUrl`: lokal `http://localhost:4002/api`, production `https://YOUR-API/api`

## Ketma-ketlik

1. **1. Login** — `access_token` environment ga yoziladi
2. Qolgan so‘rovlar collection **Bearer** auth ishlatadi

## cURL (PowerShell)

```powershell
$base = "http://localhost:4002/api"
$body = @{ login = "admin"; password = "PAROL" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = $login.access_token
$headers = @{ Authorization = "Bearer $token" }

# Qabullar
Invoke-RestMethod -Uri "$base/goods-receipts?page=1&limit=10&status=PENDING" -Headers $headers

# Jo'natmalar
Invoke-RestMethod -Uri "$base/dispatches?page=1&limit=30" -Headers $headers

# Qarz KPI
Invoke-RestMethod -Uri "$base/debts/entries/summary" -Headers $headers

# Qarz hamkor guruhlari
Invoke-RestMethod -Uri "$base/debts/partner-groups?tab=receivable&page=1&limit=40" -Headers $headers
```

## cURL (bash)

```bash
BASE="http://localhost:4002/api"
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"PAROL"}' | jq -r '.access_token')

curl -s "$BASE/goods-receipts?page=1&limit=30" -H "Authorization: Bearer $TOKEN" | jq .
curl -s "$BASE/dispatches?page=1&limit=30" -H "Authorization: Bearer $TOKEN" | jq .
curl -s "$BASE/debts/entries/summary" -H "Authorization: Bearer $TOKEN" | jq .
curl -s "$BASE/debts/partner-groups?tab=receivable&page=1&limit=40" -H "Authorization: Bearer $TOKEN" | jq .
```

## Priority 2 — products / buyurtmalar

- Default: `GET /products`, `GET /b2b-orders` → `{ items, page, limit, total, hasMore }`
- Eski massiv kerak bo‘lsa: `?all=true`

## Kutilgan javob (qisqa)

**goods-receipts / dispatches / debts/entries:**

```json
{ "items": [], "page": 1, "limit": 30, "total": 0, "hasMore": false }
```

**goods-receipts** qo‘shimcha: `summary: { pending, accepted, rejected, other }`

**debts/partner-groups:** `summary: { receivable, payable, net }`, ixtiyoriy `capped: true`

## Xatoliklar

| Kod | Sabab |
|-----|--------|
| 401 | Token yo‘q / eskirgan — qayta Login |
| 403 | Ruxsat yo‘q (`GOODS_RECEIPTS_VIEW`, `DISPATCHES_VIEW`, `DEBT_VIEW`) |
