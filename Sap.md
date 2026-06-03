# Axis ERP — Kengaytirilgan Ombor Boshqaruvi Arxitekturasi
## (SAP SD/WM/MM jarayonlarini Axis ERP ga moslashtrish)

> **Asosiy hujjat:** `arxetektura.md` → `docs/architecture/`  
> **Versiya:** 1.0 | **Sana:** 2026-05-31  
> **Maqsad:** SAP ning PO → ATP → Delivery → Picking → PGI + Physical Inventory jarayonlarini Axis ERP arxitekturasiga moslashtirish

---

## Mundarija

1. [Umumiy jarayon xaritasi](#1-umumiy-jarayon-xaritasi)
2. [ATP — Available-to-Promise (Rezerv tizimi)](#2-atp--available-to-promise-rezerv-tizimi)
3. [Outbound Delivery — Chiquvchi yukxat](#3-outbound-delivery--chiquvchi-yukxat)
4. [Picking & Packing — Saralash va qadoqlash](#4-picking--packing--saralash-va-qadoqlash)
5. [Post Goods Issue (PGI) — Tizimdan chiqarish](#5-post-goods-issue-pgi--tizimdan-chiqarish)
6. [Physical Inventory — Jismoniy sanash](#6-physical-inventory--jismoniy-sanash)
7. [Posting Block — Blokirovilar tizimi](#7-posting-block--blokirovilar-tizimi)
8. [Variance (Farq) boshqaruvi](#8-variance-farq-boshqaruvi)
9. [Prisma data model](#9-prisma-data-model)
10. [API endpointlar](#10-api-endpointlar)
11. [Telegram bildirishnomalar](#11-telegram-bildirishnomalar)
12. [Frontend ekranlar](#12-frontend-ekranlar)
13. [Implementatsiya bosqichlari](#13-implementatsiya-bosqichlari)

---

## 1. Umumiy jarayon xaritasi

### SAP vs Axis ERP qiyosiy jadval

| Bosqich | SAP nomi | Axis ERP nomi | Farqi |
|---------|----------|---------------|-------|
| 1 | Purchase Order (PO) | B2B Order | Mavjud ✅ |
| 2 | ATP Check | Rezerv tekshiruvi | **Yangi** 🔴 |
| 3 | Outbound Delivery | Dispatch (kengaytirilgan) | Qisman ✅ |
| 4 | Picking & Packing | Pick Task + Bin location | **Yangi** 🔴 |
| 5 | Post Goods Issue | Dispatch SENT → stock OUT | Mavjud ✅ |
| 6 | Physical Inventory | Inventarizatsiya moduli | **Yangi** 🔴 |
| 7 | Posting Block | StockBlock | **Yangi** 🔴 |
| 8 | Variance Settings | Farq chegarasi (kompaniya sozlamasi) | **Yangi** 🔴 |

### To'liq oqim diagrammasi

```
B2B Buyer buyurtma yuboradi
         │
         ▼
┌─────────────────────────────────────┐
│  1. B2BOrder yaratiladi (PENDING)   │
│     seller ga Telegram bildirishnoma │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. ATP CHECK (avtomat)             │
│     freeStock = onHand - reserved   │
│     ├── Yetarli → ACCEPTED          │
│     │   Rezerv qo'yiladi            │
│     └── Yetarli emas → PARTIAL/WAIT │
│         seller ga ogohlantirish     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Outbound Delivery yaratiladi    │
│     DispatchOrder (DRAFT)           │
│     Pick task omborchiga tayinlanadi │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. PICKING                         │
│     Omborchi barcode skaner bilan   │
│     bin location dan mahsulot oladi  │
│     PickTask → COMPLETED            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. POST GOODS ISSUE (PGI)          │
│     Dispatch → SENT                 │
│     StockBalance kamayadi           │
│     Rezerv o'chiriladi              │
│     DebtEntry yaratiladi            │
│     Buyer ga Telegram bildirishnoma │
└─────────────────────────────────────┘
```

---

## 2. ATP — Available-to-Promise (Rezerv tizimi)

### Kontsepsiya

SAP da ATP — buyurtma qabul qilinganda tizim avtomatik tekshiradi:
- Omborda necha dona bor? (`onHandQuantity`)
- Shundan qancha allaqachon boshqa buyurtmalarga **rezerv** qilingan? (`reservedQuantity`)
- **Erkin qoldiq** = onHand − reserved

Axis ERP da bu mavjud emas — hozir faqat `StockBalance.quantity` bor, rezerv yo'q.

### Axis ERP uchun ATP arxitekturasi

#### Yangi StockReservation entity

```typescript
// Har bir tasdiqlangan buyurtma uchun rezerv yozuvi
model StockReservation {
  id           String   @id @default(cuid())
  companyId    String
  warehouseId  String
  variantId    String
  orderId      String   // b2b_order_id
  quantity     Decimal
  status       ReservationStatus  // ACTIVE | RELEASED | CONSUMED
  expiresAt    DateTime?          // Muddatli rezerv (ixtiyoriy)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company      Company         @relation(...)
  warehouse    Warehouse       @relation(...)
  variant      ProductVariant  @relation(...)
  order        B2BOrder        @relation(...)
}

enum ReservationStatus {
  ACTIVE     // Buyurtma tasdiqlangan, tovar hali jo'natilmagan
  RELEASED   // Buyurtma bekor qilindi — rezerv bo'shatildi
  CONSUMED   // PGI bajarildi — haqiqiy chiqim bo'ldi
}
```

#### StockBalance kengaytirish

```prisma
model StockBalance {
  // Mavjud maydonlar...
  quantity          Decimal   // onHand (jismoniy bor)
  
  // YANGI maydonlar:
  reservedQuantity  Decimal   @default(0)  // ATP rezerv
  blockedQuantity   Decimal   @default(0)  // Inventarizatsiya bloki
  
  // Virtual (computed):
  // freeToPromise = quantity - reservedQuantity - blockedQuantity
}
```

#### ATP Service (NestJS)

```typescript
// modules/warehouse/atp.service.ts

@Injectable()
export class AtpService {
  constructor(private prisma: PrismaService) {}

  // Erkin qoldiqni hisoblash
  async getFreeStock(
    variantId: string,
    warehouseId: string,
    companyId: string
  ): Promise<{
    onHand: number;
    reserved: number;
    blocked: number;
    free: number;
    canFulfill: (qty: number) => boolean;
  }> {
    const balance = await this.prisma.stockBalance.findUnique({
      where: { variantId_warehouseId_companyId: { variantId, warehouseId, companyId } }
    });

    const onHand    = balance?.quantity.toNumber() ?? 0;
    const reserved  = balance?.reservedQuantity.toNumber() ?? 0;
    const blocked   = balance?.blockedQuantity.toNumber() ?? 0;
    const free      = Math.max(0, onHand - reserved - blocked);

    return {
      onHand,
      reserved,
      blocked,
      free,
      canFulfill: (qty: number) => free >= qty,
    };
  }

  // Buyurtma tasdiqlanganda rezerv qo'yish
  async createReservation(
    orderId: string,
    items: { variantId: string; warehouseId: string; quantity: number }[],
    companyId: string
  ): Promise<{ success: boolean; failedItems: string[] }> {
    const failedItems: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const stock = await this.getFreeStock(item.variantId, item.warehouseId, companyId);

        if (!stock.canFulfill(item.quantity)) {
          failedItems.push(item.variantId);
          continue;
        }

        // Rezerv yozuvi yaratish
        await tx.stockReservation.create({
          data: {
            companyId,
            warehouseId: item.warehouseId,
            variantId: item.variantId,
            orderId,
            quantity: item.quantity,
            status: 'ACTIVE',
          }
        });

        // StockBalance.reservedQuantity oshirish
        await tx.stockBalance.update({
          where: { variantId_warehouseId_companyId: {
            variantId: item.variantId,
            warehouseId: item.warehouseId,
            companyId,
          }},
          data: { reservedQuantity: { increment: item.quantity } }
        });
      }
    });

    return {
      success: failedItems.length === 0,
      failedItems,
    };
  }

  // PGI yoki bekor qilganda rezervni bo'shatish
  async releaseReservation(
    orderId: string,
    type: 'RELEASED' | 'CONSUMED'
  ): Promise<void> {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { orderId, status: 'ACTIVE' }
    });

    await this.prisma.$transaction(async (tx) => {
      for (const res of reservations) {
        await tx.stockReservation.update({
          where: { id: res.id },
          data: { status: type }
        });

        await tx.stockBalance.update({
          where: { variantId_warehouseId_companyId: {
            variantId: res.variantId,
            warehouseId: res.warehouseId,
            companyId: res.companyId,
          }},
          data: { reservedQuantity: { decrement: res.quantity } }
        });
      }
    });
  }
}
```

### ATP javob holatlari

| Holat | Shartlar | Buyurtma statusi | Harakat |
|-------|----------|-----------------|---------|
| `FULL_AVAILABLE` | Barcha items uchun yetarli free stock | ACCEPTED | Rezerv qo'yiladi |
| `PARTIAL_AVAILABLE` | Ba'zi items yetarli, ba'zilari emas | PARTIAL_ACCEPTED | Seller tanlaydi |
| `NOT_AVAILABLE` | Hech biri yetarli emas | PENDING (wait) | Seller ga Telegram |
| `BLOCKED` | Inventarizatsiya bloki bor | PENDING (wait) | Blok tugashini kutish |

---

## 3. Outbound Delivery — Chiquvchi yukxat

### Mavjud Dispatch ni kengaytirish

Hozirgi `Dispatch` modeli: buyurtma → dispatch → receipt. Biz unga **pick task** va **bin location** qo'shamiz.

```prisma
model Dispatch {
  // Mavjud maydonlar...
  
  // YANGI:
  pickTasks      PickTask[]
  deliveryNote   String?     // Yukxat raqami
  plannedShipAt  DateTime?   // Rejalashtirilgan jo'natish sanasi
}

model PickTask {
  id          String       @id @default(cuid())
  dispatchId  String
  companyId   String
  warehouseId String
  variantId   String
  
  // Qaysi joydan olish kerak
  binLocation String?      // Masalan: "A-02-3" (Regal A, qator 02, qavat 3)
  
  quantityRequired  Decimal
  quantityPicked    Decimal  @default(0)
  
  assignedTo  String?      // CompanyUser.id (omborchi)
  status      PickStatus   // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
  startedAt   DateTime?
  completedAt DateTime?
  
  scannedBarcodes  String[] // Tasdiqlash uchun skanerlangan barcode lar
  
  dispatch    Dispatch       @relation(...)
  variant     ProductVariant @relation(...)
  assignee    CompanyUser?   @relation(...)
}

enum PickStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

---

## 4. Picking & Packing — Saralash va qadoqlash

### Picking oqimi (SAP WM analogiyasi)

```
Dispatch ACCEPTED
     │
     ▼
PickTask yaratiladi (har item uchun)
     │
     ▼
Omborchiga tayinlash (assign)
     │  → Telegram: "Yangi pick task: [mahsulot] [miqdor] [bin: A-02-3]"
     ▼
Omborchi mobile/web da task ochadi
     │
     ▼
Barcode skaner bilan mahsulot tasdiqlanadi
     │  GET /pos/quick-search?barcode=XXX (mavjud endpoint)
     │  Agar barcode != kutilgan → xato ogohlanrtirish
     ▼
quantityPicked to'ldiriladi
     │
     ▼
PickTask → COMPLETED
     │
     ▼
Barcha tasks COMPLETED → Dispatch PACKED (yangi status)
     │
     ▼
PGI tasdiqlash uchun tayyor
```

### Picking Service

```typescript
// modules/warehouse/picking.service.ts

@Injectable()
export class PickingService {
  async createPickTasksForDispatch(dispatchId: string): Promise<PickTask[]> {
    const dispatch = await this.prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: { include: { variant: true } } }
    });

    // Har dispatch item uchun pick task
    const tasks = await this.prisma.$transaction(
      dispatch.items.map(item =>
        this.prisma.pickTask.create({
          data: {
            dispatchId,
            companyId: dispatch.companyId,
            warehouseId: dispatch.warehouseId,
            variantId: item.variantId,
            binLocation: await this.getBinLocation(item.variantId, dispatch.warehouseId),
            quantityRequired: item.quantity,
            status: 'PENDING',
          }
        })
      )
    );

    return tasks;
  }

  async confirmScan(
    taskId: string,
    scannedBarcode: string,
    quantity: number,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const task = await this.prisma.pickTask.findUnique({
      where: { id: taskId },
      include: { variant: true }
    });

    // Barcode tekshiruvi
    if (task.variant.barcode !== scannedBarcode && task.variant.sku !== scannedBarcode) {
      return { success: false, message: 'Noto\'g\'ri mahsulot skanerlandi' };
    }

    const newPicked = task.quantityPicked.toNumber() + quantity;

    if (newPicked > task.quantityRequired.toNumber()) {
      return { success: false, message: 'Miqdor oshib ketdi' };
    }

    await this.prisma.pickTask.update({
      where: { id: taskId },
      data: {
        quantityPicked: newPicked,
        scannedBarcodes: { push: scannedBarcode },
        assignedTo: userId,
        startedAt: task.startedAt ?? new Date(),
        status: newPicked >= task.quantityRequired.toNumber() ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: newPicked >= task.quantityRequired.toNumber() ? new Date() : undefined,
      }
    });

    return { success: true, message: 'Tasdiqlandi' };
  }

  private async getBinLocation(variantId: string, warehouseId: string): Promise<string | null> {
    // Kelajakda: WarehouseBin table dan olish
    // Hozircha: ProductVariant.warehouseBindings dan
    return null;
  }
}
```

---

## 5. Post Goods Issue (PGI) — Tizimdan chiqarish

### SAP PGI analogiyasi Axis ERP da

SAP da PGI — eng muhim moment: aynan shu lahzada ombor va buxgalteriya sinxron o'zgaradi.

Axis ERP da bu `Dispatch → SENT` holatiga o'tish vaqtida yuz beradi. Uni kuchaytirish:

```typescript
// modules/dispatch/dispatch.service.ts — postGoodsIssue metodi

async postGoodsIssue(dispatchId: string, userId: string): Promise<void> {
  const dispatch = await this.prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: { items: true, pickTasks: true, order: true }
  });

  // 1. Barcha pick tasks COMPLETED ekanligini tekshirish
  const unfinished = dispatch.pickTasks.filter(t => t.status !== 'COMPLETED');
  if (unfinished.length > 0) {
    throw new BadRequestException(
      `${unfinished.length} ta picking task hali tugallanmagan`
    );
  }

  await this.prisma.$transaction(async (tx) => {
    // 2. StockBalance kamaytirish (haqiqiy chiqim)
    for (const item of dispatch.items) {
      await tx.stockBalance.update({
        where: { ... },
        data: { quantity: { decrement: item.quantity } }
      });

      // StockMovement yozuvi (audit trail)
      await tx.stockMovement.create({
        data: {
          type: 'OUT',
          sourceType: 'B2B_DISPATCH',
          sourceId: dispatchId,
          variantId: item.variantId,
          warehouseId: dispatch.warehouseId,
          quantity: item.quantity,
          performedBy: userId,
          note: `PGI: Dispatch #${dispatch.id}`,
        }
      });
    }

    // 3. Rezervni CONSUMED ga o'tkazish
    await this.atpService.releaseReservation(dispatch.orderId, 'CONSUMED');

    // 4. Dispatch → SENT
    await tx.dispatch.update({
      where: { id: dispatchId },
      data: { status: 'SENT', sentAt: new Date() }
    });

    // 5. DebtEntry yaratish (mavjud logika)
    await this.debtService.createFromDispatch(dispatchId, tx);
  });

  // 6. Telegram bildirishnoma (buyer ga)
  await this.telegramService.notify(dispatch.order.buyerCompanyId, {
    type: 'dispatch.sent',
    dispatchId,
    items: dispatch.items,
  });
}
```

---

## 6. Physical Inventory — Jismoniy sanash

### Kontsepsiya (SAP MI01 analogiyasi)

SAP da Physical Inventory — omborni real sanaydigan va tizim bilan taqqoslaydigan jarayon. Axis ERP uchun soddalashtirilgan, lekin kuchli versiyasi:

```
Inventarizatsiya boshlash (admin/manager)
     │
     ▼
InventoryCount hujjati yaratiladi
     │  → Tegishli mahsulotlarga StockBlock qo'yiladi
     │  → Bu vaqtda o'sha mahsulotlar B2B buyurtmaga sotilmaydi
     ▼
Omborchi har mahsulotni barcode bilan skanerlaydi
     │  → Real miqdorni kiritadi
     ▼
Tizim farqni hisoblab ko'rsatadi:
     │  countedQty vs systemQty → variance
     ▼
Farq tolerance (chegara) ni oshiradimi?
     ├── Yo'q (≤ tolerance%) → Avtomat tasdiqlash
     └── Ha  → Manager tasdiqlash kerak
                │
                ├── Manager APPROVE → StockBalance yangilanadi
                │                     Farq Expense/Revenue yoziladi
                └── Manager REJECT  → Qayta sanash (RECOUNT)
```

### Yangi Prisma modellar

```prisma
model InventoryCount {
  id           String              @id @default(cuid())
  companyId    String
  warehouseId  String
  reference    String              // "INV-2026-001"
  status       InventoryStatus     // DRAFT | IN_PROGRESS | PENDING_APPROVAL | COMPLETED | CANCELLED
  
  startedAt    DateTime            @default(now())
  completedAt  DateTime?
  initiatedBy  String              // CompanyUser.id
  approvedBy   String?             // CompanyUser.id
  
  items        InventoryCountItem[]
  company      Company             @relation(...)
  warehouse    Warehouse           @relation(...)
}

model InventoryCountItem {
  id              String          @id @default(cuid())
  inventoryCountId String
  variantId       String
  binLocation     String?
  
  systemQuantity  Decimal         // Tizim ko'rsatgan miqdor (snapshot)
  countedQuantity Decimal?        // Omborchi sanagan miqdor
  variance        Decimal?        // countedQty - systemQty (+ ortiqcha, - kamomad)
  variancePct     Decimal?        // |variance| / systemQty * 100
  
  status          CountItemStatus // PENDING | COUNTED | APPROVED | REJECTED | RECOUNTING
  scannedAt       DateTime?
  scannedBy       String?         // CompanyUser.id
  note            String?
  
  count           InventoryCount  @relation(...)
  variant         ProductVariant  @relation(...)
}

model StockBlock {
  id          String      @id @default(cuid())
  companyId   String
  warehouseId String
  variantId   String
  
  reason      BlockReason // INVENTORY_COUNT | QUALITY_CHECK | MANUAL
  sourceId    String      // inventoryCountId yoki manual note
  
  blockedQty  Decimal
  createdAt   DateTime    @default(now())
  removedAt   DateTime?
  createdBy   String

  @@unique([variantId, warehouseId, companyId, reason, sourceId])
}

enum InventoryStatus {
  DRAFT
  IN_PROGRESS
  PENDING_APPROVAL
  COMPLETED
  CANCELLED
}

enum CountItemStatus {
  PENDING       // Hali skanerlanmagan
  COUNTED       // Skanerlangan, tasdiqlash kutilmoqda
  APPROVED      // Farq qabul qilindi
  REJECTED      // Qayta sanash kerak
  RECOUNTING    // Qayta sanalyapti
}

enum BlockReason {
  INVENTORY_COUNT
  QUALITY_CHECK
  MANUAL
}
```

### Physical Inventory Service

```typescript
// modules/warehouse/inventory-count.service.ts

@Injectable()
export class InventoryCountService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private configService: CompanyConfigService,
  ) {}

  // 1. Inventarizatsiya boshlash
  async startCount(
    warehouseId: string,
    variantIds: string[],  // Bo'sh = barcha mahsulotlar
    companyId: string,
    userId: string
  ): Promise<InventoryCount> {
    const variants = variantIds.length > 0
      ? variantIds
      : await this.getAllActiveVariants(warehouseId, companyId);

    // Joriy tizim qoldiqlarini snapshot qilish
    const balances = await this.prisma.stockBalance.findMany({
      where: { warehouseId, companyId, variantId: { in: variants } }
    });

    const inventoryCount = await this.prisma.$transaction(async (tx) => {
      // InventoryCount hujjati
      const count = await tx.inventoryCount.create({
        data: {
          companyId,
          warehouseId,
          reference: await this.generateReference(companyId),
          status: 'IN_PROGRESS',
          initiatedBy: userId,
          items: {
            create: balances.map(b => ({
              variantId: b.variantId,
              systemQuantity: b.quantity,  // Snapshot!
              status: 'PENDING',
            }))
          }
        },
        include: { items: true }
      });

      // Har mahsulotga StockBlock qo'yish
      await tx.stockBlock.createMany({
        data: balances.map(b => ({
          companyId,
          warehouseId,
          variantId: b.variantId,
          reason: 'INVENTORY_COUNT',
          sourceId: count.id,
          blockedQty: b.quantity,
          createdBy: userId,
        }))
      });

      // StockBalance.blockedQuantity yangilash
      for (const b of balances) {
        await tx.stockBalance.update({
          where: { ... },
          data: { blockedQuantity: b.quantity }
        });
      }

      return count;
    });

    // Manager ga Telegram
    await this.telegramService.notifyManagers(companyId, {
      type: 'inventory.started',
      reference: inventoryCount.reference,
      warehouseId,
      itemCount: inventoryCount.items.length,
    });

    return inventoryCount;
  }

  // 2. Omborchi skanerlashi va miqdor kiritishi
  async recordCount(
    countItemId: string,
    countedQty: number,
    userId: string
  ): Promise<{ variance: number; variancePct: number; needsApproval: boolean }> {
    const item = await this.prisma.inventoryCountItem.findUnique({
      where: { id: countItemId },
      include: { count: { include: { company: true } } }
    });

    const systemQty = item.systemQuantity.toNumber();
    const variance = countedQty - systemQty;
    const variancePct = systemQty > 0
      ? Math.abs(variance / systemQty) * 100
      : 100;

    // Kompaniya tolerance sozlamasini olish
    const tolerance = await this.configService.getInventoryTolerance(
      item.count.companyId
    ); // Masalan: 1.0 (1%)

    const needsApproval = variancePct > tolerance;

    await this.prisma.inventoryCountItem.update({
      where: { id: countItemId },
      data: {
        countedQuantity: countedQty,
        variance,
        variancePct,
        status: needsApproval ? 'COUNTED' : 'APPROVED',
        scannedAt: new Date(),
        scannedBy: userId,
      }
    });

    // Katta farq → manager ga Telegram darhol
    if (needsApproval) {
      await this.telegramService.notifyManagers(item.count.companyId, {
        type: 'inventory.variance_detected',
        reference: item.count.reference,
        variantId: item.variantId,
        systemQty,
        countedQty,
        variance,
        variancePct: variancePct.toFixed(2),
      });
    }

    return { variance, variancePct, needsApproval };
  }

  // 3. Manager tasdiqlashi yoki rad etishi
  async approveVariance(
    countItemId: string,
    approved: boolean,
    managerId: string,
    note?: string
  ): Promise<void> {
    const item = await this.prisma.inventoryCountItem.findUnique({
      where: { id: countItemId },
      include: { count: true }
    });

    if (!approved) {
      // Qayta sanash
      await this.prisma.inventoryCountItem.update({
        where: { id: countItemId },
        data: { status: 'RECOUNTING', note }
      });
      // Omborchiga Telegram
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // StockBalance haqiqiy miqdorga tenglashtirish
      await tx.stockBalance.update({
        where: { ... },
        data: {
          quantity: item.countedQuantity!,
          blockedQuantity: 0,
        }
      });

      // StockBlock o'chirish
      await tx.stockBlock.updateMany({
        where: { sourceId: item.inventoryCountId, variantId: item.variantId },
        data: { removedAt: new Date() }
      });

      // StockMovement — audit trail
      const variance = item.variance!.toNumber();
      if (variance !== 0) {
        await tx.stockMovement.create({
          data: {
            type: variance > 0 ? 'IN' : 'OUT',
            sourceType: 'INVENTORY_ADJUSTMENT',
            sourceId: item.inventoryCountId,
            variantId: item.variantId,
            warehouseId: item.count.warehouseId,
            quantity: Math.abs(variance),
            note: variance > 0
              ? `Inventarizatsiya: +${variance} ortiqcha topildi`
              : `Inventarizatsiya: ${variance} kamomad topildi`,
            performedBy: managerId,
          }
        });
      }

      // Item tasdiqlandi
      await tx.inventoryCountItem.update({
        where: { id: countItemId },
        data: { status: 'APPROVED', note }
      });
    });
  }

  // 4. Inventarizatsiyani yakunlash
  async completeCount(inventoryCountId: string, managerId: string): Promise<void> {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id: inventoryCountId },
      include: { items: true }
    });

    const pendingItems = count.items.filter(
      i => !['APPROVED', 'CANCELLED'].includes(i.status)
    );

    if (pendingItems.length > 0) {
      throw new BadRequestException(
        `${pendingItems.length} ta mahsulot hali tasdiqlanmagan`
      );
    }

    await this.prisma.inventoryCount.update({
      where: { id: inventoryCountId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        approvedBy: managerId,
      }
    });
  }
}
```

---

## 7. Posting Block — Blokirovilar tizimi

### SAP Posting Block analogiyasi

SAP da inventarizatsiya davomida mahsulot harakati to'xtatiladi. Axis ERP da bu `StockBlock` + `blockedQuantity` orqali amalga oshiriladi.

### B2B Order da ATP blok tekshiruvi

```typescript
// b2b-orders.service.ts — acceptOrder metodiga qo'shish

async acceptOrder(orderId: string) {
  const order = await this.prisma.b2BOrder.findUnique({
    where: { id: orderId },
    include: { items: true }
  });

  for (const item of order.items) {
    const stock = await this.atpService.getFreeStock(
      item.variantId,
      order.warehouseId,
      order.sellerCompanyId
    );

    // Blok bor?
    if (stock.blocked > 0) {
      throw new ConflictException(
        `${item.variantId}: inventarizatsiya davom etmoqda. Blok tugashini kuting.`
      );
    }

    // Yetarli erkin qoldiq bor?
    if (!stock.canFulfill(item.quantity.toNumber())) {
      throw new ConflictException(
        `Yetarli qoldiq yo'q. Erkin: ${stock.free}, Kerak: ${item.quantity}`
      );
    }
  }

  // Rezerv qo'yish
  await this.atpService.createReservation(orderId, order.items, order.sellerCompanyId);

  // Buyurtmani ACCEPTED ga o'tkazish
  // ...
}
```

---

## 8. Variance (Farq) boshqaruvi

### Kompaniya konfiguratsiyasi

```prisma
model CompanyConfig {
  // Mavjud maydonlar...
  
  // Inventarizatsiya sozlamalari
  inventoryTolerancePct   Float    @default(1.0)  // 1% dan kichik farq auto-approve
  inventoryBlockOnCount   Boolean  @default(true)  // Sanash vaqtida blok qo'yish
  inventoryRequireRecount Float    @default(5.0)   // 5% dan katta farqda qayta sanash
  inventoryAutoApprove    Boolean  @default(false) // Tolerance ichida auto-approve
}
```

### Farq holatlari va harakatlar jadvali

| Vaziyat | Tizim harakati | Telegram | Blok |
|---------|---------------|---------|------|
| `variance = 0` | Item APPROVED | — | O'chiriladi |
| `variancePct ≤ tolerance (1%)` | Auto APPROVED | — | O'chiriladi |
| `tolerance < variancePct ≤ recount (5%)` | COUNTED, manager kutish | Manager ga | Saqlanadi |
| `variancePct > recount (5%)` | RECOUNTING talab | Manager ga shoshilinch | Saqlanadi |
| Manager APPROVE | StockBalance yangilanadi | Omborchiga | O'chiriladi |
| Manager REJECT | RECOUNTING | Omborchiga | Saqlanadi |

---

## 9. Prisma data model

### To'liq yangi modellar ro'yxati

```prisma
// 1. Rezerv tizimi
model StockReservation { ... }  // ATP

// 2. Picking
model PickTask { ... }          // WM picking

// 3. Inventarizatsiya
model InventoryCount { ... }
model InventoryCountItem { ... }

// 4. Blok
model StockBlock { ... }

// 5. StockBalance kengaytirish
// + reservedQuantity Decimal @default(0)
// + blockedQuantity  Decimal @default(0)

// 6. StockMovement sourceType kengaytirish
enum StockMovementSourceType {
  // Mavjud:
  B2B_DISPATCH
  B2B_RECEIPT
  POS_SALE
  GOODS_RECEIPT
  // YANGI:
  INVENTORY_ADJUSTMENT  // Inventarizatsiya farq
  MANUAL_ADJUSTMENT     // Qo'lda tuzatish
}

// 7. CompanyConfig kengaytirish
// + inventoryTolerancePct
// + inventoryBlockOnCount
// + inventoryRequireRecount
// + inventoryAutoApprove
```

### Migration buyrug'i

```bash
cd apps/api
npx prisma migrate dev --name add_atp_inventory_picking
npx prisma generate
```

---

## 10. API endpointlar

### Yangi modullar

```
ATP:
  GET    /warehouse/stock/:variantId/availability    → free stock, reserved, blocked
  GET    /warehouse/stock/batch-availability         → ko'p variant bir vaqtda

Picking:
  GET    /dispatch/:id/pick-tasks                    → pick tasks ro'yxati
  PATCH  /pick-tasks/:id/scan                        → barcode skaner tasdiqlash
  PATCH  /pick-tasks/:id/complete                    → task yakunlash

PGI:
  POST   /dispatch/:id/post-goods-issue              → PGI bajarish (mavjud SENT ga o'xshash)

Inventarizatsiya:
  POST   /inventory-counts                           → yangi inventarizatsiya boshlash
  GET    /inventory-counts                           → ro'yxat (filter: status, warehouse)
  GET    /inventory-counts/:id                       → hujjat detali
  PATCH  /inventory-counts/:id/items/:itemId/count   → miqdor kiritish
  PATCH  /inventory-counts/:id/items/:itemId/approve → farqni tasdiqlash/rad etish
  POST   /inventory-counts/:id/complete              → inventarizatsiyani yakunlash
  DELETE /inventory-counts/:id                       → bekor qilish (faqat DRAFT)

Hisobotlar:
  GET    /reports/inventory/variances                → farqlar hisoboti
  GET    /reports/inventory/history                  → inventarizatsiya tarixi
```

---

## 11. Telegram bildirishnomalar

### Yangi notification turlari

```typescript
// Inventarizatsiya boshlanganda — manager ga
{
  type: 'inventory.started',
  text: `📦 Inventarizatsiya boshlandi\n` +
        `📍 Ombor: [warehouseName]\n` +
        `📋 Ref: [reference]\n` +
        `🔢 Mahsulotlar: [itemCount] ta\n` +
        `⚠️ Bu vaqtda ushbu mahsulotlar B2B sotuvdan bloklanadi`,
  buttons: [{ text: 'Ko\'rish', url: '/dashboard/inventory/[id]' }]
}

// Katta farq topilganda — manager ga (SHOSHILINCH)
{
  type: 'inventory.variance_alert',
  text: `🚨 Katta farq aniqlandi!\n` +
        `📦 Mahsulot: [variantName]\n` +
        `📊 Tizim: [systemQty] ta → Sanalgan: [countedQty] ta\n` +
        `📉 Farq: [variance] ta ([variancePct]%)\n` +
        `⏰ Tasdiqlash yoki qayta sanash kerak`,
  buttons: [
    { text: '✅ Tasdiqlash', callback: 'inventory_approve_[itemId]' },
    { text: '🔄 Qayta sanash', callback: 'inventory_recount_[itemId]' }
  ]
}

// Picking task — omborchiga
{
  type: 'picking.assigned',
  text: `📋 Yangi saralash vazifasi\n` +
        `📦 Mahsulot: [variantName]\n` +
        `🔢 Miqdor: [quantity] ta\n` +
        `📍 Joy: [binLocation]\n` +
        `🚚 Buyurtma: #[orderId]`,
  buttons: [{ text: 'Boshlamoq', url: '/dashboard/picking/[taskId]' }]
}

// PGI tugaganda — buyer ga
{
  type: 'dispatch.goods_issued',
  text: `✅ Tovaringiz jo'natildi!\n` +
        `📦 Buyurtma: #[orderId]\n` +
        `🚚 Dispatch: #[dispatchId]\n` +
        `📅 Sana: [date]`,
}
```

---

## 12. Frontend ekranlar

### Yangi sahifalar

```
apps/web/src/app/dashboard/
├── inventory/
│   ├── page.tsx                     ← Inventarizatsiya ro'yxati
│   ├── new/page.tsx                 ← Yangi inventarizatsiya boshlash
│   └── [id]/
│       ├── page.tsx                 ← Hujjat detali (items, status)
│       └── count/page.tsx           ← Omborchi skanerlash ekrani
├── picking/
│   ├── page.tsx                     ← Pick tasks ro'yxati (omborchi)
│   └── [taskId]/page.tsx            ← Task detali + skaner
└── warehouse/
    └── availability/page.tsx        ← ATP dashboard (stock: free/reserved/blocked)
```

### Ombor holati kartochkasi (UI konsepsiyasi)

```
┌────────────────────────────────────────────┐
│ Shakar 50kg                    SKU-001     │
│                                             │
│  Jami omborda:   100 dona                  │
│  ──────────────────────────────────        │
│  🔒 Rezerv:       15 dona  (B2B orders)    │
│  🚫 Blokda:        5 dona  (Inventarizatsiya) │
│  ✅ Erkin:        80 dona                  │
│                                             │
│  [ATP tekshirish]  [Inventarizatsiya]      │
└────────────────────────────────────────────┘
```

### Inventarizatsiya skanerlash ekrani (omborchi)

```
┌────────────────────────────────────────────┐
│  INV-2026-001 · In Progress                │
│  ─────────────────────────────────         │
│  [ Barcode skanerlang yoki SKU kiriting ]  │
│                                            │
│  Mahsulot: Shakar 50kg                     │
│  Tizim:    100 dona                        │
│  Sanalgan: [____] dona   ← kiritish        │
│                                            │
│  Farq:     — (hali kiritilmagan)           │
│                                            │
│  [Tasdiqlash ✓]                            │
└────────────────────────────────────────────┘
```

---

## 13. Implementatsiya bosqichlari

### Bosqich 1 — ATP + Rezerv (1 hafta)

| Vazifa | Taxmin |
|--------|--------|
| Prisma: `StockReservation` + `StockBalance` kengaytirish | 0.5 kun |
| `AtpService` — getFreeStock, createReservation, releaseReservation | 1 kun |
| B2B order accept da ATP integratsiya | 0.5 kun |
| B2B order cancel/delete da rezerv bo'shatish | 0.5 kun |
| PGI da rezerv CONSUMED ga o'tkazish | 0.5 kun |
| Frontend: ombor holati kartochkasida free/reserved/blocked | 0.5 kun |
| **Jami** | **~3.5 kun** |

### Bosqich 2 — Picking (1 hafta)

| Vazifa | Taxmin |
|--------|--------|
| Prisma: `PickTask` modeli | 0.25 kun |
| `PickingService` — createTasks, confirmScan, complete | 1 kun |
| API: `/dispatch/:id/pick-tasks`, `/pick-tasks/:id/scan` | 0.5 kun |
| Frontend: picking ekrani (omborchi) | 1 kun |
| Telegram: picking task bildirishnomasi | 0.5 kun |
| **Jami** | **~3.25 kun** |

### Bosqich 3 — Physical Inventory (1.5 hafta)

| Vazifa | Taxmin |
|--------|--------|
| Prisma: `InventoryCount`, `InventoryCountItem`, `StockBlock` | 0.5 kun |
| `InventoryCountService` — startCount, recordCount, approveVariance | 2 kun |
| `CompanyConfig` kengaytirish (tolerance sozlamalari) | 0.5 kun |
| API: to'liq CRUD + approve/reject | 1 kun |
| Frontend: inventarizatsiya ro'yxati + skanerlash ekrani | 1.5 kun |
| Telegram: variance alert + manager tasdiqlash tugmalari | 1 kun |
| **Jami** | **~6.5 kun** |

**Umumiy taxmin: ~13 kun (≈ 2.5 hafta)**

---

## SAP vs Axis ERP — yakuniy qiyosiy jadval

| Xususiyat | SAP S/4HANA | Axis ERP (after) | Axis ERP ustunligi |
|-----------|-------------|-----------------|-------------------|
| ATP Check | Avtomat, real-time | Avtomat, real-time | ✅ Teng |
| Rezerv | Murakkab, ko'p layer | Sodda, aniq | ✅ Tushunarliroq |
| Picking | WM modul (murakkab) | PickTask (sodda) | ✅ O'zbek ombori uchun yetarli |
| PGI | Alohida tranzaksiya | Dispatch → SENT kengaytmasi | ✅ Sodda |
| Physical Inventory | MI01-MI07 tranzaksiyalar | Bitta ekran + skaner | ✅ **Ancha sodda** |
| Posting Block | Avtomatik, qattiq | Avtomat + manager boshqaruvi | ✅ Moslashuvchan |
| Variance | Tolerance + audit | Tolerance + Telegram darhol | ✅ **Tezroq reaktsiya** |
| Telegram | Yo'q | ✅ Built-in | ✅ **SAP da yo'q** |
| Narx | $100K+ yillik | SaaS arzon | ✅ **Asosiy afzallik** |

---

*Hujjat versiyasi: 1.0 | 2026-05-31 | Axis ERP Kengaytirilgan Ombor Arxitekturasi*
