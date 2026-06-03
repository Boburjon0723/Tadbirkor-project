# Platforma yadrosi (§7–8)

> [README — indeks](./README.md) | [arxetektura.md (qisqa)](../../arxetektura.md)

---
7. Core modullar
7.1 Company Module

Kompaniyalarni boshqaradi.

Asosiy entity:
Company
- id
- name
- legal_name
- tin
- phone
- address
- business_type
- status
- trial_started_at
- trial_ends_at
- subscription_status
- created_at
- updated_at
7.2 User Module

Foydalanuvchilarni boshqaradi.
User
- id
- full_name
- phone
- email
- login
- password_hash
- status
- created_at
- updated_at
7.3 CompanyUser Module

Foydalanuvchini kompaniyaga bog‘laydi.

CompanyUser
- id
- company_id
- user_id
- role (OWNER, MANAGER, ACCOUNTANT, WAREHOUSE, SALES)
- warehouse_id (nullable; SALES va WAREHOUSE uchun majburiy — qaysi do‘kon/ombor nuqtasida ishlaydi)
- created_at

Qoidalar:
- OWNER, MANAGER, ACCOUNTANT — barcha omborlarni ko‘radi (`warehouse_id` null).
- SALES, WAREHOUSE — bitta omborga biriktiriladi; bir omborga bir nechta kassir/omborchi biriktirilishi mumkin.
- Rol berish va taklif (`invite`) vaqtida ombor scope tekshiriladi; POS va ombor operatsiyalarida backend scope majburiy.
7.4 Role & Permission Module

Rollar va ruxsatlarni boshqaradi.

Asosiy rollar:

OWNER
MANAGER
ACCOUNTANT
WAREHOUSE
SALES

Role vazifalari:

Owner:
- hamma narsani ko‘radi;
- hamma narsani boshqaradi;
- user va role yaratadi;
- narx va sozlamalarni boshqaradi.

Manager:
- mahsulot, hamkor, buyurtma, invoice va operatsion jarayonlarni boshqaradi;
- sozlamalar va userlarni boshqarmaydi.

Accountant:
- invoice, qarz, ombor harakatlari va hisobotlarni ko‘radi;
- asosan read-only observer.

Warehouse:
- ombor, kirim, chiqim, qabul qilish, stock movement bilan ishlaydi;
- narx va qarzni ko‘rmaydi.

Sales:
- buyurtma va invoice bilan ishlaydi;
- omborni boshqarmaydi.

Permission misollar:

products.view
products.create
products.update
products.delete
products.view_price
products.update_price

warehouse.view
warehouse.receive
warehouse.dispatch
warehouse.adjust
warehouse.transfer

orders.view
orders.create
orders.accept
orders.reject

invoice.view
invoice.create
invoice.send
invoice.cancel

debt.view
debt.create_payment_record
debt.confirm_payment

reports.view
reports.export

settings.manage_users
settings.manage_roles
settings.manage_company

pos.view
pos.create
pos.void
8. Module & Feature Configuration

Tizim har kompaniyaga moslashishi uchun module/feature flag ishlatiladi.

Module
- id
- key
- name
- description
Feature
- id
- module_id
- key
- name
- description
CompanyFeature
- id
- company_id
- feature_id
- enabled

Misol:

Company A:
PRODUCTS = true
WAREHOUSE = true
B2B = true
DEBT = true
POS = false
PRODUCTION = false

Frontend shu konfiguratsiyaga qarab sidebar va sahifalarni ko‘rsatadi.

Backend esa har request’da permission va feature enabled ekanini tekshiradi.

