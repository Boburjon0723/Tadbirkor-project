Here is the comprehensive bug and issue report:

Full Project Audit Report
🔴 CRITICAL — Security Issues
1. Unprotected system endpoints (no auth/permission guard)
File: 
system.controller.ts

@Post('test-e2e')
runTest() { ... }  // No guard at all

@Post('init-modules')
initModules() { ... }  // No guard at all
POST /api/system/test-e2e and POST /api/system/init-modules are completely unauthenticated. Anyone can trigger the E2E test flow or re-initialize modules. seed-stock has JwtAuthGuard but no PermissionsGuard — any authenticated user (including SALES/FIELD_WORKER) can seed stock for their company.

2. CORS allows all Vercel preview deployments
File: 
main.ts
, lines 20–30

isVercelPreview = /\.vercel\.app$/.test(new URL(origin).hostname);
if (isLocalhost || isAllowedExplicit || isVercelPreview) return callback(null, true);
Any *.vercel.app domain is trusted. An attacker can deploy a malicious app to Vercel and make authenticated cross-origin requests on behalf of logged-in users.

3. AcceptReceiptModal makes raw fetch with token from localStorage
File: 
AcceptReceiptModal.tsx
, lines ~180–200

const response = await fetch(`${API_URL}/product-mappings`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
  body: JSON.stringify({ ..., ownProductVariantId: item.productVariantId || '' })
});
ownProductVariantId is sent as item.productVariantId || '' — an empty string when no mapping exists. This will create a broken mapping record. Also bypasses the centralized api axios instance (no error handling, no interceptors).

4. updateMePassword has no old-password verification
File: 
users.service.ts
 → updatePassword

The PATCH /users/me/password endpoint accepts newPassword only. There is no check for the current password, so any authenticated session (e.g., a stolen token) can silently change the user's password.

🔴 CRITICAL — Logic Bugs
5. login crashes when user has no company memberships
File: 
auth.service.ts
, line ~80

const mainCompany = user.companies[0]; // MVP'da birinchi kompaniyani olamiz
const token = await this.generateToken(user.id, mainCompany.companyId, mainCompany.role);
If user.companies is empty (e.g., a user was removed from all companies), mainCompany is undefined and mainCompany.companyId throws a runtime TypeError. No guard exists.

6. CreateOrderModal field name mismatch: notes vs note
File: 
orders.service.ts
, lines 28–31

async createOrder(dto: CreateOrderDto) {
  const { notes, ...rest } = dto;
  const { data } = await api.post("/b2b-orders", { ...rest, note: notes });
The CreateOrderDto interface has notes?: string but the backend CreateB2BOrderDto expects note. The service correctly remaps it for createOrder, but updateDraftOrder sends the DTO directly without remapping:

async updateDraftOrder(id: string, dto: UpdateDraftOrderDto) {
  const { data } = await api.patch(`/b2b-orders/${id}`, dto);
UpdateDraftOrderDto has note?: string (correct), but the CreateOrderModal builds the payload with note: formData.notes — this is fine. However the CreateOrderDto interface still has notes (plural) which is confusing and error-prone.

7. handleAutoPrice uses wrong field from pricing suggestion response
File: 
CreateOrderModal.tsx
, lines ~230–240

if (result?.price != null) {
  handleItemChange(index, 'price', String(result.price));
But the backend getSellerPriceSuggestion returns { expectedPrice, expectedCurrency, ... } — not price. The field result.price will always be undefined, so auto-price never works.

8. partialAccept creates a new DebtEntry directly instead of using debtsService.createEntry
File: 
goods-receipts.service.ts
, lines ~340–350

await tx.debtEntry.create({
  data: { debtorId: ..., creditorId: ..., amount: totalDebtAmount, ... }
});
The accept method correctly calls this.debtsService.createEntry(...), but partialAccept bypasses the service and writes directly. If createEntry ever gains additional logic (notifications, validation), partialAccept will silently skip it.

9. rejectOrder allows rejecting a SENT order but not a DRAFT one — inconsistency
File: 
b2b-orders.service.ts
, lines ~280–290

const forbiddenStatus = ['COMPLETED', 'DISPATCHED', 'CANCELLED'];
DRAFT is not in the forbidden list, so a seller can reject a DRAFT order (which they shouldn't even see — findAll for SELLER filters status: { not: 'DRAFT' }, but findOne doesn't). A seller who knows the order ID can reject a draft.

10. 
page.tsx
 — incoming orders accept button fires on DRAFT status (wrong)
File: 
page.tsx
, lines ~220–230 (mobile view)

{activeTab === 'incoming' && (order.status === 'DRAFT' || order.status === 'SENT') ? (
  // shows accept/reject buttons
The desktop view only shows accept/reject for DRAFT, but the mobile view shows them for both DRAFT and SENT. The backend acceptOrder allows accepting SENT orders, but the desktop UI doesn't expose this. Inconsistent UX between mobile and desktop.

11. dispatch.send creates GoodsReceiptItem with productVariantId: null
File: 
dispatches.service.ts
, lines ~130–140

items: {
  create: dispatch.items.map((item) => ({
    productVariantId: null,  // ← always null
    productNameSnapshot: item.productNameSnapshot,
    quantity: item.quantity,
  })),
},
The GoodsReceiptItem is created with productVariantId: null even though the dispatch item has a valid productVariantId. The receipt acceptance flow then has to do expensive mapping lookups to find the variant. This is intentional for the buyer-side mapping flow, but it means the accept endpoint's mapping check (if (!item.mapping) throw BadRequestException) will always fail unless the auto-mapping in findOne succeeds — creating a fragile dependency.

12. stock.adjustStock uses ADJUSTMENT type but doesn't differentiate positive/negative
File: 
stock.service.ts
, lines ~100–115

await this.recordMovement(
  companyId,
  { ..., quantity: Math.abs(dto.quantity), ... },
  'ADJUSTMENT',
  'ADJUSTMENT',
  userId,
  tx
);
Math.abs(dto.quantity) is always positive. The ADJUSTMENT type in recordMovement uses quantityChange = dto.quantity (positive), so it always adds stock. There is no way to reduce stock via adjustment — the sign of the original dto.quantity is lost.

🟠 HIGH — Missing Error Handling / Unsafe Code
13. products.service.ts — processImportFile doesn't check for null file
File: 
products.controller.ts
, line ~55

importPreview(@CurrentUser() user: any, @UploadedFile() file: any) {
  return this.productsService.processImportFile(user.companyId, file.buffer);
If no file is uploaded, file is undefined and file.buffer throws. The uploads controller has a null check, but the products import endpoint does not.

14. AcceptReceiptModal — activeReceipt.items accessed before null check
File: 
AcceptReceiptModal.tsx
, lines ~60–65

const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
  receipt?.items?.reduce(...) || {}
);
receipt prop is the list-level receipt (no items array). receiptDetail is fetched async. The isPartial and currentTotal calculations run on activeReceipt.items which may be the list-level receipt without items until the query resolves — causing incorrect totals to flash.

15. 
page.tsx
 — hardcoded USD exchange rate
File: 
page.tsx
, line ~75

return (v.UZS || 0) + (v.USD || 0) * 12500; // Hardcoded approximation
A hardcoded 12500 UZS/USD rate is used for pie chart visualization. This will silently produce wrong financial charts as the rate changes. Should either use a configurable rate or display currencies separately.

16. auth.service.ts — getMe makes 3 separate DB queries (N+1 pattern)
File: 
auth.service.ts
, lines ~100–130

const user = await this.prisma.user.findUnique(...);
const company = await this.prisma.company.findUnique(...);
const companyUser = await this.prisma.companyUser.findFirst(...);
const warehouseScope = await this.warehouseScopeService.getForUser(...); // 4th query
getMe is called on every page load (dashboard, etc.) and fires 4 sequential queries. These should be parallelized with Promise.all or combined into a single query with include.

17. notifications.service.ts — notifyCompany fetches all company users on every notification
File: 
notifications.service.ts
, lines ~80–100

Every call to notifyCompany does a findMany on companyUser to get all user IDs, then createMany notifications. For a company with many users, high-frequency events (order sent, dispatch sent, receipt accepted) will generate large DB writes synchronously inside business transactions.

18. products.service.ts — findAll with warehouseId filter uses nested some — potential N+1
File: 
products.service.ts
, lines ~175–185

include: {
  variants: {
    include: { stockBalances: true }  // loads ALL balances for ALL variants
  }
}
Every product fetch loads all variants with all stock balances across all warehouses. For large catalogs this is a significant over-fetch. Should filter stockBalances to the requested warehouseId.

🟠 HIGH — Data Inconsistencies (Frontend/Backend Mismatches)
19. ordersService.getPricingSuggestion — wrong response field name
File: 
orders.service.ts
 + 
CreateOrderModal.tsx

Backend returns: { expectedPrice, expectedCurrency, productVariantId, productName, variantName }
Frontend reads: result?.price and result?.currency

Both field names are wrong. result.price → should be result.expectedPrice. result.currency → should be result.expectedCurrency.

20. debtsService.createPaymentRecord sends paymentMethod but backend ignores it
File: 
debts.service.ts
, lines ~30–35

async createPaymentRecord(payload: {
  debtId: string;
  amount: number;
  paymentMethod: string;  // sent but backend DTO doesn't have this field
  notes?: string;
}) {
  const { data } = await api.post(`/debts/${payload.debtId}/payment-records`, {
    amount: payload.amount,
    notes: payload.notes,  // paymentMethod is dropped here
  });
paymentMethod is in the TypeScript interface but silently dropped before the API call. The backend CreatePaymentRecordDto has no paymentMethod field either. Dead field in the interface.

21. CreateProductDto is defined twice with different shapes
File: 
create-product.dto.ts
 AND 
product.dto.ts

Both files export CreateProductDto. The one in create-product.dto.ts has categoryId as optional and no type/description/imageUrl. The one in product.dto.ts has categoryId as required (@IsNotEmpty()). The controller imports from product.dto.ts, but the frontend productsService.CreateProductDto interface has categoryId?: string (optional). This mismatch means the backend will reject product creation if categoryId is omitted, but TypeScript won't warn the frontend developer.

22. 
page.tsx
 — total amount displayed as so'm regardless of currency
File: 
page.tsx
, lines ~100, ~160

{new Intl.NumberFormat('uz-UZ').format(receipt.totalAmount)} so'm
totalAmount is computed server-side and may be in USD. The currency is not checked — USD amounts will be displayed as "so'm".
MEDIUM — UX Issues
23. AcceptReceiptModal uses alert() and window.confirm() for all feedback
File: 
AcceptReceiptModal.tsx
, lines ~100, ~115

Native browser alert/confirm dialogs block the UI thread, look inconsistent with the dark-themed UI, and can't be styled. Same pattern in 
page.tsx
 (confirm(...), alert(...)), 
page.tsx
, and ProductModal.tsx.

24. 
page.tsx
 — "View details" button is a no-op
File: 
page.tsx
, lines ~120, ~165

onClick={() => {/* View details logic */}}
The detail view button exists in both desktop and mobile layouts but has no implementation. Users can see the sale list but cannot drill into individual sales.

25. 
page.tsx
 — products not shown until warehouse is selected, but no prompt on load
File: 
page.tsx
, lines ~130–140

const displayedProducts = !selectedWarehouseId ? [] : ...
The page silently shows an empty table until a warehouse is selected. The empty state message only appears after the data loads. On first visit, users see a loading spinner followed by an empty table with no clear call-to-action to select a warehouse.

26. CreateDispatchModal — error from sendDispatch is silently swallowed
File: 
CreateDispatchModal.tsx
, lines ~45–55

} catch (err) {
  console.error(err);
}
If createDispatch succeeds but sendDispatch fails, the modal closes (it doesn't — onClose() is inside the try block after sendDispatch), but actually the catch block doesn't call onClose, so the modal stays open with no error message shown to the user. The user sees a frozen loading state.

27. use-pos.ts — createSale mutation has no onSuccess cache invalidation
File: 
use-pos.ts
, lines ~15–20

const createSaleMutation = useMutation({
  mutationFn: (dto: CreatePosSaleDto) => posService.createSale(dto),
  // no onSuccess
});
After creating a sale, the pos-sales and pos-summary query caches are not invalidated. The sales list won't update until the next manual refetch or page reload.

🟡 MEDIUM — TypeScript / Type Safety
28. Pervasive any usage in controllers and hooks
Multiple files use @CurrentUser() user: any, @Body() body: { rows: any[] }, query: any, and hook parameters typed as any. Key examples:

products.controller.ts line 30: @Query() query: any
products.service.ts throughout: dto.variants as any[]
b2b-orders.service.ts: (partner as any)?.warehouseVisibilityConfig
page.tsx
: getSimpleSum(v: any)
29. field.service.ts — approveTask accesses userStock!.id without null check
File: 
field.service.ts
, lines ~310–320

await tx.userStock.update({
  where: { id: userStock!.id },
  data: { quantity: { decrement: item.usedQty } },
});
userStock is fetched with findUnique and could be null if the worker's stock record was deleted or never created. The non-null assertion ! will throw at runtime.

30. reports.service.ts — getDebtorsReport and getCreditorsReport use query.status as any
File: 
reports.service.ts
, lines ~280, ~305

status: query.status as any || { in: ['OPEN', 'PARTIAL'] }
If query.status is an empty string "" (falsy), the || fallback works. But if it's any non-empty invalid string like "INVALID", Prisma will silently return no results instead of throwing a validation error.

🟡 MEDIUM — Performance
31. reports.service.ts — getStockMovementAnalytics loads all movements into memory
File: 
reports.service.ts
, lines ~380–400

const movements = await this.prisma.stockMovement.findMany({
  where: { companyId, createdAt: { gte: startDate } },
  include: { productVariant: { include: { product: true } } }
});
All movements for the last N days are loaded into Node.js memory and aggregated in JS. For active companies this could be tens of thousands of records. Should use groupBy with Prisma aggregations.

32. dashboard.service.ts — getStats runs 8 parallel queries but two use .then() chaining
File: 
dashboard.service.ts
, lines ~15–70

totalInventoryValue, totalDebts, and totalCredits each do a findMany followed by a .then() reduce in JS. These should use groupBy + _sum aggregations at the DB level.

33. StockBalance has no index on companyId + productVariantId
File: 
schema.prisma

@@unique([warehouseId, productVariantId])
@@index([companyId])
@@index([productVariantId])
There is no composite index on (companyId, productVariantId). The getBalances query filters by both, and the recordMovement lookup uses findUnique on the unique constraint (which is indexed), but the getBalances with only companyId will do a full scan of the company's balances.

🟢 LOW — Dead Code / Minor Issues
34. products.service.ts — sortBy === 'salePrice' is broken
File: 
products.service.ts
, lines ~165–175

} else if (sortBy === 'salePrice') {
  orderBy = { variants: { _count: sortOrder } }; // This is a placeholder, actual variant sorting is complex
  orderBy = { createdAt: sortOrder }; // immediately overwritten
}
The first assignment is immediately overwritten. The comment acknowledges it's a placeholder but the dead assignment is confusing.

35. b2b-orders.service.ts — leftover console.log debug statements in production
File: 
b2b-orders.service.ts
, lines ~200–220

console.log('--- DEBUG: acceptOrder START ---');
console.log('Request ID:', id);
console.log('Order Seller ID in DB:', order.sellerCompanyId);
10+ console.log debug statements in acceptOrder. Same in dispatches.service.ts (create method). These leak internal data to server logs in production.

36. dispatches.service.ts — dispatchNumber is not unique per company
File: 
dispatches.service.ts
, line ~80

dispatchNumber: `DSP-${Date.now()}`,
Date.now() is used as a dispatch number. Under concurrent requests (two dispatches created within the same millisecond), this could produce duplicate numbers. The schema has no unique constraint on dispatchNumber. Should use a sequential counter like POS sales do.

37. auth.service.ts — inviteUser returns the raw user object including passwordHash
File: 
auth.service.ts
, lines ~145–160

const user = await tx.user.create({ data: { ..., passwordHash, ... } });
return user;
The created user is returned directly, which includes passwordHash in the response. Should select only safe fields.

38. use-session.ts / auth.service.ts — token stored in localStorage (XSS risk)
File: 
auth.service.ts
, lines ~8–12

JWT stored in localStorage is accessible to any JavaScript on the page, making it vulnerable to XSS attacks. httpOnly cookies would be more secure, though this is a common trade-off in SPAs.

Summary by severity:

Severity	Count
🔴 Critical	12
🟠 High	10
🟡 Medium	10
🟢 Low	6
The most urgent fixes are: the unprotected system endpoints (#1), the login crash on empty companies (#5), the auto-price field name mismatch (#7/#19), the adjustStock sign bug (#12), and the AcceptReceiptModal broken mapping call (#3).

Mana loyihadagi barcha muammolar — jiddiylik darajasi bo'yicha:

🔴 Kritik — Darhol tuzatish kerak
1. system.controller.ts — Himoyasiz xavfli endpointlar

@Post('test-e2e')
runTest() { ... }  // ← JwtAuthGuard yo'q, hech kim chaqira oladi

@Post('init-modules')
initModules() { ... }  // ← JwtAuthGuard yo'q, production'da ochiq
Har kim POST /api/system/test-e2e va POST /api/system/init-modules ga so'rov yuborib, DB'ni buzishi mumkin.

2. auth.service.ts — Login crash qiladi

const mainCompany = user.companies[0]; // ← companies bo'sh bo'lsa crash
const token = await this.generateToken(user.id, mainCompany.companyId, ...);
// TypeError: Cannot read properties of undefined
Foydalanuvchi hech bir kompaniyaga biriktirilmagan bo'lsa — server 500 qaytaradi.

3. AcceptReceiptModal.tsx — Mapping tugmasi bo'sh string yuboradi

body: JSON.stringify({
  ownProductVariantId: item.productVariantId || ''  // ← '' bo'sh string!
})
productVariantId null bo'lsa, API'ga bo'sh string yuboriladi → backend xato beradi, lekin foydalanuvchi "Moslashtirish" tugmasini bosib hech narsa bo'lmaydi.

4. inviteUser — passwordHash javobda qaytadi
return user;  // ← user obyektida passwordHash mayd
