# Axis ERP — Mobile Arxitektura

> **Versiya:** 1.0  
> **Sana:** 2026-05-26  
> **Asosiy arxitektura:** `arxetektura.md` → `docs/architecture/`  
> **Stack:** Expo (React Native) + NestJS API (mavjud) + Supabase + Redis

---

## Mundarija

1. [Umumiy ko'rinish](#1-umumiy-korinish)
2. [Tech Stack](#2-tech-stack)
3. [Loyiha tuzilmasi](#3-loyiha-tuzilmasi)
4. [Autentifikatsiya](#4-autentifikatsiya)
5. [Modullar va ekranlar](#5-modullar-va-ekranlar)
6. [POS moduli (kassa)](#6-pos-moduli-kassa)
7. [B2B zanjiri](#7-b2b-zanjiri)
8. [Qarz daftari](#8-qarz-daftari)
9. [Ombor va mahsulotlar](#9-ombor-va-mahsulotlar)
10. [Telegram integratsiya](#10-telegram-integratsiya)
11. [Offline rejim](#11-offline-rejim)
12. [Push bildirishnomalar](#12-push-bildirishnomalar)
13. [Barcode / QR skaner](#13-barcode--qr-skaner)
14. [API aloqasi](#14-api-aloqasi)
15. [Holat boshqaruvi](#15-holat-boshqaruvi)
16. [Navigatsiya](#16-navigatsiya)
17. [Deploy va CI/CD](#17-deploy-va-cicd)
18. [Xavfsizlik](#18-xavfsizlik)
19. [Implementatsiya bosqichlari (Roadmap)](#19-implementatsiya-bosqichlari-roadmap)

---

## 1. Umumiy ko'rinish

Axis ERP mobil ilovasi — mavjud NestJS API'ga ulangan **Expo** asosidagi React Native ilova. Web versiyadan alohida repo yoki `apps/mobile/` monorepo papkasida joylashadi.

### Asosiy tamoyillar

| Tamoyil | Izoh |
|---------|------|
| **API birinchi** | Hamma logika API da — mobile faqat UI va UX |
| **Modul yo'nali** | Web dagi modul tizimi (POS, B2B, Warehouse) mobilga ko'chiriladi |
| **Offline-aware** | Tarmoq yo'qligida asosiy ekranlar cache'dan ishlaydi |
| **Role-based** | SALES, BUYER, ADMIN, ACCOUNTANT — mobilda ham permission guard |
| **Ombor scope** | `CompanyUser.warehouse_id` — foydalanuvchi faqat o'z omborini ko'radi |

### Nima mobile uchun, nima web uchun

| Funksiya | Mobile | Web |
|----------|--------|-----|
| POS kassa (sotish) | ✅ Asosiy | ✅ |
| Barcode skaner | ✅ Kamera + HID | ✅ HID |
| B2B buyurtma yuborish | ✅ | ✅ |
| B2B buyurtma qabul qilish | ✅ | ✅ |
| Mahsulot import (Excel) | ❌ Web only | ✅ |
| Hisobotlar | ✅ Ko'rish (read-only) | ✅ To'liq |
| Qarz daftari | ✅ | ✅ |
| Ombor sozlamalari | ❌ Web only | ✅ |
| Admin panel | ❌ Web only | ✅ |

---

## 2. Tech Stack

```
Mobile:
├── Expo SDK 52+              — React Native framework
├── Expo Router v3            — File-based navigation
├── React Query v5            — Server state
├── Zustand                   — Client state
├── MMKV                      — Tezkor lokal saqlash (token, cache)
├── Expo Camera               — Kamera skaner
├── expo-barcode-scanner      — Barcode/QR o'qish
├── expo-notifications        — Push bildirishnomalar
├── expo-secure-store         — Token xavfsiz saqlash
├── NativeWind / Tamagui      — UI stillash
└── React Hook Form + Zod     — Formalar va validatsiya

Backend (mavjud, o'zgarishsiz):
├── NestJS + Prisma
├── PostgreSQL (Supabase)
├── Redis (BullMQ + Cache)
└── Railway deploy
```

### Nima uchun Expo?

- Web versiyasi ham React — komponent logikasi umumiylashtirilishi mumkin
- OTA update (Expo Updates) — app store kutmasdan patch
- EAS Build — CI/CD oson
- expo-camera barcode/QR uchun yetarli

---

## 3. Loyiha tuzilmasi

```
apps/mobile/                          ← Expo loyihasi
├── app/                              ← Expo Router (fayl = route)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── select-company.tsx
│   ├── (app)/
│   │   ├── _layout.tsx               ← Tab navigatsiya
│   │   ├── pos/
│   │   │   ├── index.tsx             ← POS kassa
│   │   │   ├── history.tsx           ← Cheklar tarixi
│   │   │   └── customers.tsx         ← Chakana mijozlar + qarz
│   │   ├── orders/
│   │   │   ├── index.tsx             ← B2B buyurtmalar ro'yxati
│   │   │   ├── [id].tsx              ← Buyurtma detali
│   │   │   └── create.tsx            ← Yangi buyurtma
│   │   ├── warehouse/
│   │   │   ├── index.tsx             ← Ombor qoldig'i
│   │   │   └── [id].tsx              ← Mahsulot detali
│   │   ├── debts/
│   │   │   ├── index.tsx             ← Qarz daftari
│   │   │   └── [id].tsx              ← Qarz detali + to'lov
│   │   ├── reports/
│   │   │   └── index.tsx             ← POS + B2B hisobotlar
│   │   └── settings/
│   │       └── index.tsx             ← Profil, ombor, logout
│   └── +not-found.tsx
│
├── features/                         ← Modullar bo'yicha komponentlar
│   ├── pos/
│   │   ├── PosCart.tsx
│   │   ├── PosProductSearch.tsx
│   │   ├── PosBarcodeScanner.tsx
│   │   ├── PosCheckoutModal.tsx
│   │   ├── PosCustomerSelect.tsx
│   │   └── hooks/
│   │       ├── use-pos-cart.ts
│   │       └── use-barcode-scan.ts
│   ├── orders/
│   │   ├── OrderCard.tsx
│   │   ├── OrderStatusBadge.tsx
│   │   └── OrderActionButtons.tsx
│   ├── debts/
│   │   ├── DebtCard.tsx
│   │   └── PaymentForm.tsx
│   └── warehouse/
│       ├── StockCard.tsx
│       └── ProductVariantList.tsx
│
├── lib/
│   ├── api/
│   │   ├── client.ts                 ← Axios instance + interceptor
│   │   ├── auth.api.ts
│   │   ├── pos.api.ts
│   │   ├── orders.api.ts
│   │   ├── debts.api.ts
│   │   └── warehouse.api.ts
│   ├── store/
│   │   ├── auth.store.ts             ← Zustand: token, user, company
│   │   └── pos-cart.store.ts         ← Zustand: savat holati
│   ├── hooks/
│   │   ├── use-permissions.ts
│   │   └── use-module-enabled.ts
│   └── utils/
│       ├── format-currency.ts
│       └── format-date.ts
│
├── components/                       ← Umumiy UI komponentlar
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── BottomSheet.tsx
│   │   └── Toast.tsx
│   └── layout/
│       ├── Screen.tsx
│       └── Header.tsx
│
├── constants/
│   ├── permissions.ts
│   └── module-keys.ts
│
├── app.json
├── eas.json                          ← EAS Build konfiguratsiya
├── babel.config.js
└── tsconfig.json
```

---

## 4. Autentifikatsiya

### 4.1 Oqim

```
App ochiladi
    ↓
MMKV / SecureStore → token bor?
    ├── Yo'q → /login
    └── Bor  → token valid? (GET /auth/me)
                  ├── Yo'q (401) → /login
                  └── Ha  → kompaniyalar ro'yxati
                               ├── 1 ta → to'g'ridan tabga
                               └── Ko'p → /select-company
```

### 4.2 Token saqlash

```typescript
// lib/store/auth.store.ts
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  company: Company | null;
  warehouseId: string | null;
  permissions: string[];
  moduleKeys: string[];
}
```

- `accessToken` + `refreshToken` → `expo-secure-store` (shifrlangan)
- `user`, `company`, `permissions` → Zustand (RAM) + MMKV (persist)
- Web dagi httpOnly cookie o'rniga mobile Bearer token ishlatadi

### 4.3 API Interceptor

```typescript
// lib/api/client.ts
const client = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
});

// Request: token qo'shish
client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response: 401 → refresh → retry
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      // refresh token oqimi
      const newToken = await refreshAccessToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return client(error.config);
      }
      // refresh ham o'ldi → logout
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
```

### 4.4 Kompaniya tanlash

Foydalanuvchi bir nechta kompaniyaga tegishli bo'lishi mumkin. Login → `GET /auth/my-companies` → tanlash → `POST /auth/select-company` → yangi token (company-scoped).

---

## 5. Modullar va ekranlar

### 5.1 Modul nazorati

Web dagi `moduleKeys` / `areModuleKeysEnabled` tizimi mobilga ham tatbiq qilinadi:

```typescript
// lib/hooks/use-module-enabled.ts
export function useModuleEnabled(key: ModuleKey): boolean {
  const moduleKeys = useAuthStore((s) => s.moduleKeys);
  return moduleKeys.includes(key);
}

// Foydalanish:
const isPosEnabled = useModuleEnabled('POS');
```

### 5.2 Tab navigatsiya (rolga qarab)

```
SALES roli:
  🛒 POS  |  📦 Ombor  |  ⚙️ Sozlamalar

BUYER roli:
  📋 Buyurtmalar  |  💰 Qarzlar  |  ⚙️ Sozlamalar

ADMIN roli:
  🛒 POS  |  📋 Buyurtmalar  |  📦 Ombor  |  💰 Qarzlar  |  📊 Hisobot  |  ⚙️ Sozlamalar

ACCOUNTANT roli:
  💰 Qarzlar  |  📊 Hisobot  |  ⚙️ Sozlamalar
```

Tab navigatsiya `useAuthStore` dan `role` o'qib dinamik quriladi.

---

## 6. POS moduli (kassa)

### 6.1 Ekranlar

```
/pos (index)      — Asosiy kassa: qidiruv + savat + checkout
/pos/history      — Cheklar tarixi (PosSalesHistoryTab)
/pos/customers    — Chakana mijozlar + qarz (POS UX qayta tuzish rejasidan)
```

### 6.2 Kassa oqimi

```
Mahsulot qidirish (nom / SKU / barcode)
         ↓
GET /pos/quick-search?q=... yoki ?barcode=...
         ↓
Savatga qo'shish → miqdor + narx
         ↓
Mijoz tanlash (ixtiyoriy, nasiya uchun majburiy)
         ↓
To'lov turi: CASH | CREDIT
         ↓
POST /pos/checkout
         ↓
Chek (receipt) ekrani → yopish
```

### 6.3 Savat holati (Zustand)

```typescript
// lib/store/pos-cart.store.ts
interface CartItem {
  variantId: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  currency: 'UZS' | 'USD';
  quantity: number;
}

interface PosCartStore {
  items: CartItem[];
  customerId: string | null;
  paymentType: 'CASH' | 'CREDIT';
  // actions
  addItem: (item: CartItem) => void;
  updateQty: (variantId: string, qty: number) => void;
  removeItem: (variantId: string) => void;
  setCustomer: (id: string | null) => void;
  setPaymentType: (type: 'CASH' | 'CREDIT') => void;
  clear: () => void;
}
```

### 6.4 Chakana mijozlar ekrani (`/pos/customers`)

POS UX qayta tuzish rejasiga mos — bitta ekranda:
- Mijozlar ro'yxati + joriy qarz summalari
- Mijoz tanlanganda: ochiq qarzlar, to'lov qo'shish, to'lovlar tarixi
- `GET /retail-customers?include=balances` endpointiga ulanadi

### 6.5 `posCreditEnabled` nazorati

```typescript
// Nasiya tab — faqat credit yoqilgan kompaniyada
const company = useAuthStore((s) => s.company);
if (!company?.posCreditEnabled) {
  // "Nasiyani yoqish" banner ko'rsatiladi
}
```

---

## 7. B2B zanjiri

### 7.1 Ekranlar

```
/orders           — Buyurtmalar ro'yxati (status bo'yicha filter)
/orders/create    — Yangi buyurtma
/orders/[id]      — Buyurtma detali: items, status, dispatch/receipt
```

### 7.2 Buyer oqimi (mobile)

```
Seller katalogidan mahsulot tanlash (GET /b2b-catalog)
         ↓ quantity > 0 filtri
Miqdor va narx kiritish (valyuta: UZS / USD)
         ↓
POST /b2b-orders
         ↓
Buyurtma yuborildi → Telegram bildirishnoma (seller ga)
         ↓
Seller ACCEPTED/REJECTED → Telegram buyer ga
```

### 7.3 Seller oqimi (mobile)

```
Kiruvchi buyurtmalar ro'yxati → PENDING filter
         ↓
Buyurtma detali → mapping (narx kelishish)
         ↓
ACCEPT yoki REJECT
         ↓
ACCEPTED → Dispatch yaratish (ombor chiqim)
         ↓
Dispatch SENT → Buyer ga bildirishnoma
```

### 7.4 Buyurtma statuslari (mobile badge ranglari)

| Status | Rang |
|--------|------|
| PENDING | Sariq |
| ACCEPTED | Ko'k |
| REJECTED | Qizil |
| DISPATCHED | To'q ko'k |
| RECEIVED | Yashil |
| PARTIALLY_RECEIVED | To'q sariq |
| CANCELLED | Kulrang |

---

## 8. Qarz daftari

### 8.1 Ekranlar

```
/debts            — Qarz ro'yxati (creditor/debtor ko'rinish)
/debts/[id]       — Qarz detali + to'lov qo'shish
```

### 8.2 Oqim

```
GET /debts (company debt entries)
         ↓
DebtEntry card: partner, summa, qoldiq, valyuta
         ↓
To'lov yozish → POST /debts/:id/payments
         ↓
Telegram: creditor ga tasdiqlash xabari
         ↓
CONFIRMED → remainingAmount kamayadi
```

### 8.3 Ko'rinish rejimlari

- **Creditor ko'rinish** — menga qarzdorlar (men bergan qarzlar)
- **Debtor ko'rinish** — men qarzim bor (B2B savdodan chiqqan)

Bir ekranda tab orqali almashtirish.

---

## 9. Ombor va mahsulotlar

### 9.1 Ekranlar

```
/warehouse        — Mahsulotlar qoldig'i (faqat o'z ombori)
/warehouse/[id]   — Mahsulot detali: variantlar, qoldiq, barkod
```

### 9.2 Ombor scope

```typescript
// Foydalanuvchining ombori
const warehouseId = useAuthStore((s) => s.warehouseId);

// API chaqiruvida avtomatik:
GET /warehouse/stock?warehouseId=${warehouseId}
```

### 9.3 Nima ko'rsatiladi

- Mahsulot nomi, SKU, barcode
- Joriy qoldiq (StockBalance)
- So'nggi harakat (kirim/chiqim sanasi)
- Variant ranglari va o'lchamlari

### 9.4 Nima yo'q (mobile)

- Mahsulot yaratish / tahrirlash → Web only
- Excel import → Web only
- Kategoriya boshqarish → Web only
- Ombor sozlamalari (ustunlar) → Web only

---

## 10. Telegram integratsiya

Mobile ilova Telegram bot bilan **bevosita** ishlamaydi. Logika to'liq backendda.

Mobile ilova faqat:
1. Bildirishnoma qabul qiladi (Push Notification → deep link)
2. Deep link orqali tegishli ekran ochiladi

```
Telegram → Backend webhook → Push Notification (Expo) → Mobile ilova
```

### Deep link misollar

```
axiserp://orders/uuid-123        → /orders/uuid-123
axiserp://debts/uuid-456         → /debts/uuid-456
axiserp://pos/customers/uuid-789 → /pos/customers
```

---

## 11. Offline rejim

### 11.1 Strategiya

Mobile tarmoqsiz holatda ba'zi ma'lumotlarni ko'rsata olishi kerak.

| Ma'lumot | Offline holati |
|----------|----------------|
| POS katalog (mahsulotlar) | MMKV cache — 15 daqiqa |
| Savat holati | Zustand persist (MMKV) |
| Buyurtmalar ro'yxati | React Query cache |
| Qarz ro'yxati | React Query cache |
| Ombor qoldig'i | React Query cache |

### 11.2 POS offline

POS kassa asosiy funksiya — tarmoq yo'qligida ham ishlashi kerak:

```typescript
// Mahsulot katalog — local cache
const CATALOG_CACHE_KEY = 'pos_catalog';
const CATALOG_TTL = 15 * 60 * 1000; // 15 daqiqa

// Checkout offline bo'lsa — queue ga saqlash
interface OfflineCheckout {
  cartItems: CartItem[];
  customerId?: string;
  paymentType: 'CASH' | 'CREDIT';
  timestamp: number;
}

// Tarmoq qaytganda — avtomatik sync
NetInfo.addEventListener((state) => {
  if (state.isConnected) {
    syncOfflineCheckouts();
  }
});
```

### 11.3 React Query offline konfiguratsiya

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 daqiqa stale
      gcTime: 30 * 60 * 1000,           // 30 daqiqa cache
      networkMode: 'offlineFirst',       // cache dan avval
      retry: (count, error) => {
        if (error.response?.status === 401) return false;
        return count < 2;
      },
    },
  },
});
```

---

## 12. Push bildirishnomalar

### 12.1 Texnologiya

`expo-notifications` + Expo Push Service → Backend → Expo API

### 12.2 Backend qo'shimcha (NestJS)

```typescript
// modules/notifications/expo-push.service.ts
// Expo Push Token saqlash va xabar yuborish

interface PushToken {
  userId: string;
  companyId: string;
  token: string;          // ExponentPushToken[...]
  platform: 'ios' | 'android';
}

async sendPush(tokens: string[], notification: {
  title: string;
  body: string;
  data?: Record<string, string>;  // deep link uchun
}) {
  // POST https://exp.host/--/api/v2/push/send
}
```

### 12.3 Mobile token ro'yxatdan o'tish

```typescript
// App ochilganda
useEffect(() => {
  registerForPushNotifications().then((token) => {
    if (token) {
      api.post('/notifications/register-token', {
        token,
        platform: Platform.OS,
      });
    }
  });
}, []);
```

### 12.4 Bildirishnoma turlari

| Hodisa | Receiver | Matn |
|--------|----------|------|
| Yangi B2B buyurtma | Seller | "Yangi buyurtma: [Buyer nomi]" |
| Buyurtma qabul/rad | Buyer | "Buyurtmangiz [ACCEPTED/REJECTED]" |
| Dispatch yuborildi | Buyer | "Tovar yo'lda: [Dispatch ID]" |
| Receipt tasdiqlandi | Seller | "Tovar qabul qilindi" |
| Qarz to'lovi | Creditor | "To'lov keldi: [summa] [valyuta]" |
| To'lov tasdiqlandi | Debtor | "To'lovingiz tasdiqlandi" |

---

## 13. Barcode / QR skaner

### 13.1 Kamera skaner (asosiy — mobile)

Mobil uchun HID skaner emas, **kamera** asosiy:

```typescript
// features/pos/PosBarcodeScanner.tsx
import { CameraView, useCameraPermissions } from 'expo-camera';

export function PosBarcodeScanner({ onScan, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const variant = await posApi.quickSearch({ barcode: data });
    if (!variant) {
      Toast.show('Mahsulot topilmadi');
      setTimeout(() => setScanned(false), 1500);
      return;
    }

    onScan(variant);
    onClose();
  };

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'qr', 'code128'] }}
      onBarcodeScanned={handleBarCodeScanned}
    />
  );
}
```

### 13.2 Qo'llab-quvvatlanadigan barcode turlari

- EAN-13 (chakana savdo standart)
- EAN-8
- Code128 (B2B omborlar)
- QR Code (kelajak: chek QR)

### 13.3 POS ga integratsiya

```
POS ekranida kamera ikonkasi bosiladi
         ↓
PosBarcodeScanner modal ochiladi (bottom sheet)
         ↓
Kamera barcode o'qiydi
         ↓
GET /pos/quick-search?barcode=XXX
         ↓
Variant topildi → savatga qo'shiladi → modal yopiladi
```

---

## 14. API aloqasi

### 14.1 Endpointlar (mobile ishlatadigan)

```
Auth:
  POST   /auth/login
  POST   /auth/refresh
  GET    /auth/me
  GET    /auth/my-companies
  POST   /auth/select-company

POS:
  GET    /pos/quick-search          ?q=&barcode=
  GET    /pos/catalog               (ombor scope)
  POST   /pos/checkout
  GET    /pos/sales                 (tarix)
  GET    /pos/sales/:id

Retail:
  GET    /retail-customers          ?include=balances
  GET    /retail-customers/:id/ledger
  POST   /retail-receivables/:id/payments

B2B Orders:
  GET    /b2b-orders
  GET    /b2b-orders/:id
  POST   /b2b-orders
  PATCH  /b2b-orders/:id/status     (accept/reject)
  DELETE /b2b-orders/:id            (cheklovlar bilan)

Debts:
  GET    /debts
  GET    /debts/:id
  POST   /debts/:id/payments

Warehouse:
  GET    /warehouse/stock           (ombor qoldig'i)
  GET    /products/:id              (mahsulot detali)

Reports:
  GET    /reports/pos/summary
  GET    /reports/pos/daily

Notifications:
  POST   /notifications/register-token
  DELETE /notifications/remove-token
```

### 14.2 Request/Response format

Mavjud API bilan to'liq mos. Hech qanday API o'zgarishi kerak emas — mavjud endpoint lar ishlatiladi.

Faqat yangi:
- `POST /notifications/register-token` — push token saqlash
- `DELETE /notifications/remove-token` — logout da o'chirish

### 14.3 Error handling

```typescript
// lib/api/client.ts
const handleApiError = (error: AxiosError) => {
  if (!error.response) {
    // Tarmoq xatosi
    Toast.show('Tarmoq xatosi. Internetni tekshiring.');
    return;
  }

  switch (error.response.status) {
    case 400: Toast.show(error.response.data?.message || 'Noto\'g\'ri so\'rov'); break;
    case 401: // interceptor handle qiladi
    case 403: Toast.show('Ruxsatingiz yo\'q'); break;
    case 404: Toast.show('Ma\'lumot topilmadi'); break;
    case 409: Toast.show(error.response.data?.message || 'Konflikt'); break;
    case 500: Toast.show('Server xatosi. Keyinroq urinib ko\'ring.'); break;
    default:  Toast.show('Xato yuz berdi');
  }
};
```

---

## 15. Holat boshqaruvi

### 15.1 Zustand store lar

```typescript
// Global auth holati
useAuthStore: {
  token, refreshToken, user, company,
  warehouseId, permissions, moduleKeys,
  login(), logout(), updateCompany()
}

// POS savat (session)
usePosCartStore: {
  items, customerId, paymentType,
  addItem(), updateQty(), removeItem(),
  setCustomer(), setPaymentType(), clear()
}
```

### 15.2 React Query keys

```typescript
export const queryKeys = {
  // Auth
  me: ['me'],
  companies: ['companies'],

  // POS
  posCatalog: (warehouseId: string) => ['pos', 'catalog', warehouseId],
  posSearch: (q: string) => ['pos', 'search', q],
  posSales: (filters: object) => ['pos', 'sales', filters],
  retailCustomers: () => ['retail-customers'],
  retailCustomer: (id: string) => ['retail-customers', id],

  // Orders
  orders: (filters: object) => ['orders', filters],
  order: (id: string) => ['orders', id],

  // Debts
  debts: (filters: object) => ['debts', filters],
  debt: (id: string) => ['debts', id],

  // Warehouse
  stock: (warehouseId: string) => ['stock', warehouseId],
  product: (id: string) => ['products', id],

  // Reports
  posReport: (params: object) => ['reports', 'pos', params],
};
```

---

## 16. Navigatsiya

### 16.1 Expo Router tuzilmasi

```
app/
├── _layout.tsx              ← Root layout (auth check)
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── select-company.tsx
└── (app)/
    ├── _layout.tsx          ← Tab navigatsiya (rolga qarab)
    ├── pos/
    │   ├── _layout.tsx      ← Stack navigator
    │   ├── index.tsx
    │   ├── history.tsx
    │   └── customers.tsx
    ├── orders/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── create.tsx
    │   └── [id].tsx
    ├── warehouse/
    │   ├── index.tsx
    │   └── [id].tsx
    ├── debts/
    │   ├── index.tsx
    │   └── [id].tsx
    ├── reports/
    │   └── index.tsx
    └── settings/
        └── index.tsx
```

### 16.2 Auth guard

```typescript
// app/_layout.tsx
export default function RootLayout() {
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) {
      router.replace('/(auth)/login');
    }
  }, [token]);

  return <Slot />;
}
```

### 16.3 Deep linking konfiguratsiya

```json
// app.json
{
  "expo": {
    "scheme": "axiserp",
    "plugins": [
      ["expo-router", {
        "origin": "https://app.axiserp.uz"
      }]
    ]
  }
}
```

---

## 17. Deploy va CI/CD

### 17.1 EAS Build

```json
// eas.json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://api-dev.railway.app" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://api-staging.railway.app" }
    },
    "production": {
      "env": { "EXPO_PUBLIC_API_URL": "https://api.railway.app" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "..." },
      "android": { "serviceAccountKeyPath": "./google-sa.json" }
    }
  }
}
```

### 17.2 OTA Update (Expo Updates)

```typescript
// app/_layout.tsx — OTA update tekshiruvi
import * as Updates from 'expo-updates';

async function checkForUpdates() {
  if (!__DEV__) {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  }
}
```

### 17.3 Environment o'zgaruvchilar

```env
# .env (Expo Public = frontendda ko'rinadi)
EXPO_PUBLIC_API_URL=https://api.railway.app
EXPO_PUBLIC_APP_ENV=production

# .env.local (secret — EAS secrets orqali)
EAS_SECRET_SENTRY_DSN=https://...@sentry.io/...
```

### 17.4 GitHub Actions

```yaml
# .github/workflows/mobile-build.yml
name: EAS Build
on:
  push:
    branches: [main]
    paths: ['apps/mobile/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: cd apps/mobile && eas build --platform all --non-interactive
```

---

## 18. Xavfsizlik

### 18.1 Token xavfsizligi

| Nima | Qayerda | Usul |
|------|---------|------|
| accessToken | expo-secure-store | iOS Keychain / Android Keystore |
| refreshToken | expo-secure-store | Xuddi shu |
| User data | MMKV | Encrypt option bilan |
| Savat holati | Zustand persist | RAM only (restart = tozalanadi) |

### 18.2 Certificate Pinning (ixtiyoriy, katta mijozlar uchun)

```typescript
// lib/api/client.ts
// react-native-ssl-pinning yoki expo-modules custom
```

### 18.3 Root/Jailbreak aniqlash

```typescript
// MVP uchun shart emas, keyingi versiya
import JailMonkey from 'jail-monkey';

if (JailMonkey.isJailBroken()) {
  Alert.alert('Xavfsizlik ogohlantirishi', 
    'Qurilmangiz xavfli. Ilova ishlamaydi.');
}
```

### 18.4 Permissions guard (mobile)

```typescript
// lib/hooks/use-permissions.ts
export function useHasPermission(permission: string): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return permissions.includes(permission);
}

// Foydalanish:
const canCreateOrder = useHasPermission('b2b-orders.create');
if (!canCreateOrder) return <AccessDenied />;
```

---

## 19. Implementatsiya bosqichlari (Roadmap)

### Bosqich 1 — MVP Kassa (2 hafta)

| Vazifa | Taxmin |
|--------|--------|
| Expo loyiha sozlash, EAS konfiguratsiya | 0.5 kun |
| Auth ekranlar (login, company select) | 1 kun |
| API client + interceptor + token | 0.5 kun |
| Zustand store lar (auth, cart) | 0.5 kun |
| POS kassa ekrani (qidiruv + savat) | 2 kun |
| Kamera barcode skaner | 1 kun |
| POS checkout (CASH + CREDIT) | 1 kun |
| Chakana mijozlar + qarz (POS markazi) | 1.5 kun |
| Cheklar tarixi | 0.5 kun |
| **Jami** | **~8.5 kun** |

### Bosqich 2 — B2B + Qarz (2 hafta)

| Vazifa | Taxmin |
|--------|--------|
| B2B buyurtmalar ro'yxati + filter | 1 kun |
| Buyurtma detali (status, mapping) | 1 kun |
| Yangi buyurtma yaratish | 1.5 kun |
| Buyurtma qabul/rad | 0.5 kun |
| Qarz daftari ro'yxati | 1 kun |
| Qarz detali + to'lov qo'shish | 1 kun |
| Ombor qoldig'i ekrani | 1 kun |
| **Jami** | **~7 kun** |

### Bosqich 3 — Bildirishnomalar + Hisobot (1 hafta)

| Vazifa | Taxmin |
|--------|--------|
| Push notification (Expo + backend) | 1.5 kun |
| Deep link (bildirishnomadan ekranga) | 0.5 kun |
| POS hisobot ekrani | 1 kun |
| Offline cache (React Query persist) | 1 kun |
| **Jami** | **~4 kun** |

### Bosqich 4 — Polishing + Store (1 hafta)

| Vazifa | Taxmin |
|--------|--------|
| OTA update | 0.5 kun |
| App Store / Google Play tayyorlash | 1 kun |
| Error tracking (Sentry) | 0.5 kun |
| Performance optimizatsiya | 1 kun |
| **Jami** | **~3 kun** |

**Umumiy taxmin: ~23 kun (≈ 5 hafta)**

---

## Qo'shimcha eslatmalar

### Web bilan kod ulashish

`apps/mobile/` va `apps/web/` monorepo ichida bo'lsa, quyidagilarni ulashish mumkin:

```
packages/
├── shared-types/     ← TypeScript interfeyslari (API response tiplari)
├── shared-utils/     ← format-currency, format-date, validation
└── shared-constants/ ← permissions, module-keys, status enums
```

### API o'zgarishlari (faqat 2 ta yangi)

1. `POST /notifications/register-token` — push token saqlash
2. `DELETE /notifications/remove-token` — logout da o'chirish

Boshqa barcha endpointlar mavjud va o'zgarishsiz.

### Prisma model o'zgarishlari

```prisma
model PushToken {
  id         String   @id @default(cuid())
  userId     String
  companyId  String
  token      String   @unique
  platform   String   // 'ios' | 'android'
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id])
  company Company @relation(fields: [companyId], references: [id])
}
```

---

*Hujjat versiyasi: 1.0 | 2026-05-26 | Axis ERP Mobile Arxitektura*
