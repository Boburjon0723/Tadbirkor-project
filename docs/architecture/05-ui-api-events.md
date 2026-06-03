# UI, API va oqimlar (§21–29)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
21. Role-based interface

Har bir rol login qilganda o‘ziga mos sahifaga yo‘naltiriladi.

Owner → /dashboard
Manager → /dashboard
Accountant → /debts yoki /reports
Warehouse → /warehouse
Sales → /orders yoki /invoices

Misol:

Omborchi ko‘radi:

Dashboard
Ombor
Kirim
Chiqim
Qabul qilish
Stock movement
Vazifalar
Bildirishnomalar

Omborchi ko‘rmaydi:

Qarz daftari
Narxlar
Foyda
Sozlamalar
Userlar

Buxgalter ko‘radi:

Invoice
Qarz daftari
Ombor harakatlari read-only
Hisobotlar

Buxgalter qila olmaydi:

Mahsulot qo‘shish
Narx o‘zgartirish
Ombor kirim/chiqim qilish
22. Asosiy biznes flow
22.1 Xaridor buyurtma yuboradi
Buyer company
    ↓
Create B2B Order
    ↓
Send to Seller
    ↓
Seller receives notification
22.2 Sotuvchi buyurtmani ko‘radi
Incoming Order
    ↓
Check product mapping
    ↓
Accept / Reject / Partial accept
    ↓
Create internal tasks
22.3 Mahsulot mapping
Partner product
    ↓
Existing product variantga bog‘lash
    yoki
New product variant yaratish
    ↓
Mapping saved
22.4 Tovar jo‘natish
Seller prepares dispatch
    ↓
Stock checked
    ↓
Seller stock OUT
    ↓
Buyer receives pending goods receipt
22.5 Tovar qabul qilish
Buyer opens goods receipt
    ↓
Product mapping checked
    ↓
Accept / Partial accept / Reject
    ↓
Buyer stock IN
    ↓
DebtEntry created
22.6 Qarz yopish
Debtor marks payment
    ↓
Creditor receives confirmation request
    ↓
Creditor confirms
    ↓
Debt updated or closed
23. API arxitekturasi

MVP’da REST API yetarli.

Auth
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
Onboarding
POST /onboarding/company
POST /onboarding/questions
POST /onboarding/modules/apply
POST /onboarding/team
Company
GET /companies/me
PATCH /companies/me
GET /companies/features
PATCH /companies/features
Users & Roles
GET /users
POST /users
PATCH /users/:id
POST /users/:id/reset-password

GET /roles
POST /roles
PATCH /roles/:id
GET /roles/:id/permissions
PATCH /roles/:id/permissions
Products
GET /products
POST /products
GET /products/:id
PATCH /products/:id

POST /products/:id/variants
PATCH /product-variants/:id
GET /product-variants/search
Warehouse
GET /warehouses
POST /warehouses
GET /warehouses/:id/stock
GET /stock-movements
POST /stock-adjustments
Partners
GET /partners
POST /partners/request
POST /partners/:id/accept
POST /partners/:id/reject
Product Mapping
GET /product-mappings
POST /product-mappings
PATCH /product-mappings/:id
GET /product-mappings/missing
B2B Orders
GET /b2b-orders
POST /b2b-orders
GET /b2b-orders/:id
POST /b2b-orders/:id/send
POST /b2b-orders/:id/accept
POST /b2b-orders/:id/reject
Dispatch
POST /dispatches
GET /dispatches
GET /dispatches/:id
POST /dispatches/:id/send
Goods Receipt
GET /goods-receipts
GET /goods-receipts/:id
POST /goods-receipts/:id/accept
POST /goods-receipts/:id/partial-accept
POST /goods-receipts/:id/reject
Debt
GET /debts
GET /debts/entries
GET /debts/partners/:partnerCompanyId
POST /debts/:debtEntryId/payment-records
POST /debt-payment-records/:id/confirm
POST /debt-payment-records/:id/reject
POS
GET /pos/quick-search
GET /pos/summary/today
POST /pos/sales
GET /pos/sales
GET /pos/sales/:id
PATCH /pos/sales/:id
POST /pos/sales/:id/checkout
POST /pos/sales/:id/void
DELETE /pos/sales/:id
GET /companies/pos-settings
Retail customers (POS module)
GET /retail-customers
GET /retail-customers/search
POST /retail-customers
PATCH /retail-customers/:id
Retail receivables (POS + posCreditEnabled)
GET /retail-receivables
POST /retail-receivables/:id/payments
POS reports (PosSale source only)
GET /reports/pos/summary
GET /reports/pos/top-products
Users (scope)
GET /users/me/warehouse-scope
PATCH /users/company/members/:membershipId/role (body: role, warehouse_id)
POST /auth/invite (body: role, warehouse_id — SALES/WAREHOUSE uchun majburiy)
Tasks
GET /tasks
GET /tasks/my
PATCH /tasks/:id/status
POST /tasks/:id/assign
24. Event-driven jarayonlar

MVP’da Redis + BullMQ ishlatiladi.

Eventlar:

company.created
onboarding.completed
user.invited

b2b_order.created
b2b_order.sent
b2b_order.accepted
b2b_order.rejected

product_mapping.required
product_mapping.created

dispatch.sent
goods_receipt.accepted
goods_receipt.rejected

stock.out
stock.in

debt.created
debt.payment_record.created
debt.payment_record.confirmed
debt.closed

task.created
notification.created
audit.created

Misol:

goods_receipt.accepted
    → buyer stock IN
    → debt entry created
    → notification sent
    → audit log created
25. Tavsiya etilgan texnologiyalar
Frontend
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
TanStack Table
React Hook Form
Zod
Zustand
Recharts
Backend
NestJS
TypeScript
Prisma ORM
REST API
Swagger/OpenAPI
JWT
Argon2 yoki bcrypt
BullMQ
Database
PostgreSQL
Cache & Queue
Redis
BullMQ

Keyingi bosqich:

RabbitMQ
Kafka
File Storage
MinIO
S3-compatible Object Storage
PDF
Playwright PDF
yoki
Puppeteer
Email
SMTP
SendGrid
Mailgun
Amazon SES
Monitoring
Sentry
Pino yoki Winston
Prometheus — keyingi bosqich
Grafana — keyingi bosqich
Deployment
Docker
Docker Compose
Nginx
Ubuntu VPS
Let's Encrypt SSL

Keyingi bosqich:

Kubernetes
Managed PostgreSQL
Managed Redis
CI/CD pipeline
Testing
Jest
Supertest
React Testing Library
Playwright
Testcontainers
26. Loyiha strukturasi
b2b-erp-platform/
│
├── apps/
│   ├── web/
│   │   └── Next.js frontend
│   │
│   └── api/
│       └── NestJS backend
│
├── packages/
│   ├── shared/
│   │   └── shared types, constants
│   │
│   └── ui/
│       └── reusable UI components
│
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/
│   └── scripts/
│
├── docs/
│   ├── architecture/           # To‘liq arxitektura bo‘limlari (README.md — indeks)
│   ├── RAILWAY-SUPABASE-DATABASE.md
│   ├── RAILWAY-REDIS.md
│   └── architecture-audit-2026-05-09.md
├── arxetektura.md              # Qisqa indeks → docs/architecture/
├── IMPLEMENTATION-POS-RETAIL.md
├── XATOLAR.MD
│
└── README.md
27. Backend modul strukturasi
apps/api/src/
│
├── modules/
│   ├── auth/
│   ├── onboarding/
│   ├── companies/
│   ├── users/
│   ├── roles/
│   ├── modules-features/
│   ├── partners/
│   ├── products/
│   ├── product-mappings/
│   ├── warehouses/
│   ├── b2b-orders/
│   ├── invoices/
│   ├── dispatches/
│   ├── goods-receipts/
│   ├── debts/
│   ├── pos/
│   ├── retail-customers/
│   ├── retail-receivables/
│   ├── field/
│   ├── workflows/
│   ├── tasks/
│   ├── notifications/
│   ├── reports/
│   ├── audit-logs/
│   └── files/
│
├── common/
│   ├── guards/
│   ├── decorators/
│   ├── interceptors/
│   ├── filters/
│   └── utils/
│
├── prisma/
│   └── schema.prisma
│
└── main.ts
28. MVP chegarasi

MVP’da bo‘ladi:

Landing
Registration
Onboarding
Company setup
Role setup
Dynamic modules
Product + Variant
Basic Warehouse
Partner
Product Mapping
B2B Order
Invoice
Dispatch
Goods Receipt
Debt Ledger
Payment confirmation record
Tasks
Notifications
Audit Log
Basic Reports
POS (asosiy kassa: chek, naqd, ombordan OUT, rol + ombor scope)

MVP’da bo‘lmaydi yoki keyingi bosqich:

Chek printer integratsiyasi
Click/Payme / bank / real payment gateway
POS smena (shift) va X-Z hisobot
POS qaytarish (refund) — hozir VOID
POS narx kelishish (override + PIN + audit) — reja
POS aralash to‘lov (bitta chekda bir nechta usul)
POS karta / Click-Payme gateway
Payroll
Full accounting
Advanced production
AI analytics
Faktoring
Trust Score

29. Xulosa

Ushbu tizimning asosiy farqi:

Oddiy ERP bitta kompaniya ichida ishlaydi.
Bu tizim esa kompaniyalar orasidagi oldi-berdi, ombor, invoice va qarzni sinxron yuritadi.

Eng muhim qiymat:

Tadbirkor buyurtma beradi.
Hamkor qabul qiladi.
Mahsulot mapping orqali moslashadi.
Sotuvchidan OUT bo‘ladi.
Xaridorga IN bo‘ladi.
Qarz avtomatik shakllanadi.
To‘lov tasdiqlansa, qarz yopiladi.

Bu yondashuv tizimni real biznesga mos, xavfsiz, soddaroq va kengaytirishga tayyor qiladi.

---
