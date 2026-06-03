# POS — Skaner (Barcode/QR) Arxitekturasi

> **Asosiy arxitektura:** `arxetektura.md` — §9, §10, §30, §31  
> **Implementatsiya rejasi:** `IMPLEMENTATION-POS-RETAIL.md`  
> **Oxirgi yangilanish:** 2026-05-21

---

## 1. Maqsad

POS kassasida mahsulotni **barcode yoki QR skaner** orqali tezkor qidirish va savatga qo'shish. Kassir har mahsulotni qo'lda qidirmasdan, skaner bilan bir zarbda chekga kiritadi.

**Asosiy qoidalar (mavjud arxitektura bilan moslik):**
- Skaner `ProductVariant.barcode` yoki `ProductVariant.sku` orqali qidiradi.
- Mavjud `GET /pos/quick-search` endpoint kengaytiriladi — barcode parametri qo'shiladi.
- Ombor scope (`CompanyUser.warehouse_id`) saqlanadi — faqat o'sha omborning qoldig'i tekshiriladi.
- `StockBalance` manfiy ketmasligi prinsipi saqlanadi.
- Yangi entity yoki jadval **kerak emas** — mavjud `ProductVariant.barcode` ishlatiladi.

---

## 2. Ma'lumotlar bazasi (o'zgarishsiz)

Mavjud sxema to'liq yetarli. Hech qanday yangi jadval kerak emas.

```
ProductVariant
- barcode   ← skaner shu maydonni qidiradi
- sku       ← fallback qidiruv
- sale_price
- status    ← faqat ACTIVE variantlar qaytariladi

StockBalance
- warehouse_id  ← SALES foydalanuvchining scope'i
- quantity      ← 0 bo'lsa ogohlantirish
```

**Barcode bo'sh bo'lsa:** kassir qo'lda `quick-search` (nom/SKU) orqali qidiradi — bu oqim allaqachon mavjud.

---

## 3. Backend — API kengaytirish

### 3.1 Mavjud endpoint kengaytirish

**`GET /pos/quick-search`** — barcode parametri qo'shiladi:

```
GET /pos/quick-search?barcode=4870000123456
GET /pos/quick-search?q=shakar
```

**Qidiruv ustuvorligi (§12.3 dan ilhom olingan):**
1. `barcode` aniq moslik (eng tez, skaner uchun)
2. `sku` aniq moslik
3. `q` nom bo'yicha qisman moslik

**Response (o'zgarishsiz formatda):**
```json
{
  "id": "variant-uuid",
  "name": "Shakar 50kg",
  "sku": "SKU-001",
  "barcode": "4870000123456",
  "salePrice": 150000,
  "stockQuantity": 42,
  "warehouseId": "warehouse-uuid"
}
```

**Qoidalar:**
- Faqat `status: ACTIVE` variantlar.
- `stockQuantity` — foydalanuvchining `warehouse_id` bo'yicha `StockBalance.quantity`.
- `stockQuantity === 0` bo'lsa ham qaytariladi (frontend ogohlantirib qo'yadi).
- Guard: `JwtAuthGuard` + `PermissionsGuard(['pos.create'])` + ombor scope.

### 3.2 Backend modul joylashuvi

```
apps/api/src/modules/pos/
├── pos.controller.ts     ← GET /pos/quick-search kengaytiriladi
├── pos.service.ts        ← findByBarcode() metodi qo'shiladi
└── dto/
    └── quick-search.dto.ts  ← barcode?: string qo'shiladi
```

**`pos.service.ts` qo'shimcha metod:**
```typescript
async findByBarcode(barcode: string, warehouseId: string, companyId: string) {
  const variant = await this.prisma.productVariant.findFirst({
    where: {
      company_id: companyId,
      barcode: barcode,
      status: 'ACTIVE',
    },
    include: {
      stock_balances: {
        where: { warehouse_id: warehouseId },
      },
    },
  });
  if (!variant) return null;
  return {
    ...variant,
    stockQuantity: variant.stock_balances[0]?.quantity ?? 0,
  };
}
```

---

## 4. Frontend — Skaner integratsiyasi

### 4.1 Skaner turlari

| Tur | Texnologiya | Holat |
|-----|-------------|-------|
| USB/Bluetooth HID skaner | `keydown` event — skaner Enter bilan tugaydi | **Asosiy, MVP** |
| Kamera skaner (mobil/PWA) | `@zxing/browser` yoki `html5-qrcode` | Keyingi bosqich |

**MVP:** USB/Bluetooth HID skaner — eng arzonga va tez ishlaydi. Kassir klaviaturaga ulangan skaner bilan ishlaydi, u barcodeni matn kabi yuboradi va Enter bosadi.

### 4.2 Komponent joylashuvi

```
apps/web/src/features/pos/
├── PosCustomerStrip.tsx      ← mavjud
├── PosBarcodeScanner.tsx     ← YANGI
└── hooks/
    └── use-barcode-scan.ts   ← YANGI
```

### 4.3 `use-barcode-scan.ts` — HID hook

```typescript
// Skanerdan kirayotgan tezkor klaviatura inputini ushlab oladi
// Inson klaviaturasidan farq: skaner ~50ms ichida barcha belgilarni yuboradi

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const bufferRef = useRef('');
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input/textarea fokusida bo'lsa — skanner trigger ishlamaydi
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 4) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        clearTimeout(timerRef.current);
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        // 100ms ichida yangi belgi kelmasa — buffer tozalanadi
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}
```

### 4.4 `PosBarcodeScanner.tsx` — UI komponenti

```tsx
export function PosBarcodeScanner({ onAddItem }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound'>('idle');

  const handleScan = useCallback(async (barcode: string) => {
    setStatus('loading');
    const variant = await posService.quickSearch({ barcode });
    if (!variant) {
      setStatus('notfound');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }
    if (variant.stockQuantity === 0) {
      toast.warning(`${variant.name} — omborda qoldiq yo'q`);
    }
    onAddItem(variant);
    setStatus('idle');
  }, [onAddItem]);

  useBarcodeScanner(handleScan);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {status === 'idle' && <span>🔍 Skaner tayyor</span>}
      {status === 'loading' && <span>⏳ Qidirilmoqda...</span>}
      {status === 'notfound' && (
        <span className="text-destructive">❌ Mahsulot topilmadi</span>
      )}
    </div>
  );
}
```

### 4.5 POS sahifasiga integratsiya

`/pos` sahifasidagi (`app/pos/page.tsx` → `features/pos/`) mavjud POS komponentiga qo'shiladi:

```tsx
// features/pos/PosCheckout.tsx (mavjud fayl)
import { PosBarcodeScanner } from './PosBarcodeScanner';

// Mavjud handleAddItem funksiyasi — o'zgarishsiz
<PosBarcodeScanner onAddItem={handleAddItem} />
```

---

## 5. Oqim diagrammasi

```
Kassir skaner bilan mahsulotni o'qiydi
         ↓
useBarcodeScanner (keydown event) → barcode string
         ↓
GET /pos/quick-search?barcode=XXX
         ↓ (backend)
ProductVariant.barcode → aniq moslik
StockBalance (warehouse scope)
         ↓
{ variant, stockQuantity }
         ↓ (frontend)
stockQuantity === 0? → toast ogohlantirish (lekin qo'shiladi)
         ↓
savatga qo'shiladi (mavjud handleAddItem)
         ↓
CASH yoki CREDIT checkout (mavjud oqim — o'zgarishsiz)
         ↓
StockMovement OUT (source_type: POS_SALE) — mavjud
```

---

## 6. Xato holatlari

| Holat | Reaction |
|-------|----------|
| Barcode topilmadi | Toast: "Mahsulot topilmadi", qo'lda qidirishga o'tish |
| Ombor qoldig'i 0 | Toast ogohlantirish, lekin qo'shishga ruxsat (mavjud qoida) |
| Tarmoq xatosi | Toast: "Aloqa xatosi, qayta skanlang" |
| Skanerlash paytida input fokusda | Hook ishlamaydi — inson matn yozmoqda |

---

## 7. Keyingi bosqich (v2)

| Vazifa | Tavsif |
|--------|--------|
| Kamera skaner | `@zxing/browser` — mobil/PWA uchun, §33.10 bilan mos |
| QR chek | `PosSale` dan QR generatsiya — to'lov/tarix uchun |
| Barcode yo'q mahsulot | Import vaqtida `barcode` maydonini to'ldirish talab qilish |
| Ommaviy barcode import | Excel orqali `ProductVariant.barcode` mass-update |

---

## 8. Implementatsiya bosqichlari

| # | Vazifa | Taxminiy vaqt |
|---|--------|----------------|
| 1 | `GET /pos/quick-search` — `barcode` param qo'shish | 1 soat |
| 2 | `pos.service.ts` — `findByBarcode()` metodi | 1 soat |
| 3 | `use-barcode-scan.ts` hook | 2 soat |
| 4 | `PosBarcodeScanner.tsx` komponenti | 1 soat |
| 5 | POS sahifasiga integratsiya + test | 1 soat |
| **Jami** | | **~6 soat** |

---

## 9. Mavjud tizim bilan integratsiya jadvali

| Mavjud qism | Foydalanish |
|-------------|-------------|
| `ProductVariant.barcode` | Asosiy qidiruv maydoni |
| `GET /pos/quick-search` | Kengaytiriladi (barcode param) |
| `WarehouseScopeService` | Ombor scope saqlanadi |
| `PermissionsGuard(['pos.create'])` | Skaner ham shu guard ostida |
| `StockBalance` | Qoldiq tekshiruvi |
| `handleAddItem` (mavjud POS UI) | O'zgarishsiz qoladi |
| `StockMovement (POS_SALE)` | Checkout oqimi o'zgarishsiz |
| `RetailCustomer` / `RetailReceivable` | Nasiya oqimi o'zgarishsiz |
