# Umumiy ko‘rinish (§1–3)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
## 1. Loyiha maqsadi

Ushbu tizim kichik va o‘rta tadbirkorlar uchun moslashuvchan B2B ERP platforma bo‘lib, har bir kompaniyaga o‘z biznes turiga qarab kerakli bo‘limlarni chiqaradi.

Tizim quyidagilarni boshqaradi:

- kompaniya va foydalanuvchilar;
- rollar va ruxsatlar;
- mahsulotlar va mahsulot variantlari;
- ombor va qoldiq;
- hamkor kompaniyalar;
- B2B buyurtmalar;
- invoice;
- tovar jo‘natish va qabul qilish;
- mahsulot mapping;
- qarz daftari;
- ichki vazifalar;
- bildirishnomalar;
- audit log;
- hisobotlar;
- chakana kassa (POS) — asosiy oqim (naqd, nasiya, mijoz);
- chakana mijozlar va mijozlar qarzi (B2B qarzdan alohida);
- POS hisoboti (faqat kassa cheklaridan).

MVP’da to‘liq POS ekotizimi (chek printer, real to‘lov gateway, smena/X-Z, narx PIN) qisman reja chegarasida. Asosiy kassa oqimi (chek, ombordan chiqim, mijoz, nasiya, rol + ombor scope) amalga oshirilgan.

---

## 2. Asosiy konsept

Tizimning asosiy g‘oyasi:

> Bitta platforma, lekin har bir tadbirkor uchun o‘ziga mos ERP.

Ya’ni har bir tadbirkor ro‘yxatdan o‘tganda tizim unga savollar beradi:

- Biznesingiz turi qanday?
- Sizda ombor bormi?
- Siz hamkorlar bilan ishlaysizmi?
- Sizda nasiya yoki qarzga savdo bormi?
- Sizda mahsulot variantlari bormi?
- Sizda xodimlar bormi?
- Kim qaysi bo‘limga mas’ul?

Shu javoblarga qarab tizim:

- kerakli modullarni yoqadi;
- keraksiz bo‘limlarni yashiradi;
- sidebar va dashboardni moslashtiradi;
- role-based interface yaratadi.

---

## 3. Asosiy arxitektura oqimi

```text
Marketing Website
    ↓
Registration
    ↓
Company Setup
    ↓
Business Onboarding Questions
    ↓
Module / Feature Configuration
    ↓
Team & Role Setup
    ↓
Dynamic Dashboard
    ↓
B2B ERP Application
Frontend Layer
    ↓
API Layer
    ↓
Auth & RBAC Layer
    ↓
Business Modules
    ↓
Workflow / Event Layer
    ↓
Database & Storage Layer
    ↓
Integration Layer
Frontend Layer

Frontend quyidagilardan iborat bo‘ladi:

marketing website;
registration;
onboarding flow;
web app dashboard;
role-based interface;
mobile/PWA interface.

Tavsiya etilgan texnologiyalar:
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
Frontendning asosiy vazifalari:

foydalanuvchi ro‘yxatdan o‘tishi;
biznes savollariga javob berishi;
tizimni avtomatik moslashtirish;
role-based dashboard ko‘rsatish;
mahsulot, ombor, B2B, invoice, qarz va vazifalarni boshqarish.
Backend Layer

Backend modular monolith sifatida boshlanadi.

Tavsiya etilgan texnologiyalar:
NestJS
TypeScript
Prisma ORM
PostgreSQL
Redis
BullMQ
Swagger/OpenAPI
JWT
Argon2 yoki bcrypt
Nega modular monolith?

MVP uchun tez;
boshqarish oson;
deployment sodda;
keyinchalik alohida servisga ajratish mumkin.
