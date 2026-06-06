# Axis ERP (Tadbirkor)

Axis ERP is a highly customizable, modular B2B Enterprise Resource Planning (ERP) and Point of Sale (POS) platform designed to streamline operations for Small and Medium Enterprises (SMEs). The platform dynamically adjusts its interface and feature set based on the business type and onboarding choices, ensuring every entrepreneur gets a tailor-made ERP experience.

---

## 🌟 Key Features

* **Dynamic Business Onboarding:** Customizes the dashboard, sidebar, and active modules (Warehouse, Debts, Partners, Variant Products, Employees) based on a smart onboarding questionnaire.
* **Multi-Warehouse Inventory Management:** Real-time stock level tracking, multi-warehouse support, incoming/outgoing shipment tracking, and flexible product variant configurations.
* **B2B Supply Chain & Partner Sync:** Peer-to-peer ordering flows, automated invoice generation, shipping & receiving logistics, and a smart product mapping system between partner companies.
* **Point of Sale (POS) / Retail Checkout:** A fast retail kassa system supporting cash payments, customer debt tracking (nasiya), and checkout reports.
* **Debt Book (Qarz Daftari):** Automated credit and debt logs for both B2B partners and retail consumers, complete with structured payment history.
* **Real-Time Notification Engine:** Instant notifications for orders, debt updates, and company tasks powered by WebSockets (Socket.io).
* **Field Service Mobile Application:** A cross-platform mobile app built for field operations, drivers, and sales agents to track stock levels and log deliveries on-the-go.

---

## 🛠️ Technology Stack

### Frontend Client
* **Framework:** Next.js (App Router) & React 18+
* **Language:** TypeScript
* **Styling:** Tailwind CSS & shadcn/ui
* **State Management & Data Fetching:** Zustand & TanStack Query (v5)
* **Charts:** Recharts

### Backend API
* **Framework:** NestJS (Modular Monolith architecture)
* **Language:** TypeScript
* **ORM:** Prisma ORM
* **Database:** PostgreSQL (with Supabase connection)
* **Caching & Queues:** Redis & BullMQ
* **Real-Time:** WebSockets / Socket.io Gateways

### Mobile App
* **Framework:** Expo & React Native

---

## 📂 Project Structure

```text
Tadbirkor/
├── apps/
│   ├── web/        # Next.js frontend dashboard & marketing site
│   └── api/        # NestJS REST & WebSocket API
├── mobile/         # Expo React Native mobile client for field operations
├── docs/           # Comprehensive system architecture & database documentation
└── README.md       # Project overview (you are here)
```

---

## 🔒 Architecture & Security

* **Role-Based Access Control (RBAC):** Granular permission controls restricting access to dashboards, warehouses, and financial books based on user roles.
* **Database Optimization:** Structured indexing and query optimization on PostgreSQL combined with a Redis caching layer for fast API response times.
* **Code Quality:** Strict TypeScript mode enforced across the monorepo to guarantee type safety.
