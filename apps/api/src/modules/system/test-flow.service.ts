import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { PartnersService } from '../partners/partners.service';
import { ProductMappingsService } from '../product-mappings/product-mappings.service';
import { B2BOrdersService } from '../b2b-orders/b2b-orders.service';
import { B2BOrderWorkflowService } from '../b2b-orders/b2b-order-workflow.service';
import { DispatchesService } from '../dispatches/dispatches.service';
import { GoodsReceiptAcceptService } from '../goods-receipts/goods-receipt-accept.service';
import { DebtsService } from '../debts/debts.service';
import { computeTrialEndsAt } from '../../common/trial.util';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TestFlowService {
  private readonly logger = new Logger(TestFlowService.name);

  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private warehousesService: WarehousesService,
    private partnersService: PartnersService,
    private mappingsService: ProductMappingsService,
    private ordersService: B2BOrdersService,
    private orderWorkflow: B2BOrderWorkflowService,
    private dispatchesService: DispatchesService,
    private receiptsAcceptService: GoodsReceiptAcceptService,
    private debtsService: DebtsService,
  ) {}

  async runE2EFlow() {
    this.logger.log('Starting E2E B2B Flow Test...');

    try {
      // 1. Cleanup old test data (optional but recommended for repeatable tests)
      await this.cleanup();

      // 2. Create Companies
      const sellerComp = await this.prisma.company.create({
        data: {
          name: 'Azizbek Savdo',
          legalName: 'Azizbek Savdo MCHJ',
          tin: '123456789',
          trialEndsAt: computeTrialEndsAt(),
        },
      });

      const buyerComp = await this.prisma.company.create({
        data: {
          name: 'Baraka Market',
          legalName: 'Baraka Market OK',
          tin: '987654321',
          trialEndsAt: computeTrialEndsAt(),
        },
      });

      // Create dummy users for each company
      const sellerUser = await this.prisma.user.create({
        data: {
          fullName: 'Seller Admin',
          login: 'seller_admin',
          passwordHash: await bcrypt.hash('password', 10),
          companies: { create: { companyId: sellerComp.id, role: 'OWNER' } },
        },
      });

      const buyerUser = await this.prisma.user.create({
        data: {
          fullName: 'Buyer Admin',
          login: 'buyer_admin',
          passwordHash: await bcrypt.hash('password', 10),
          companies: { create: { companyId: buyerComp.id, role: 'OWNER' } },
        },
      });

      this.logger.log('Companies and Users created.');

      // 3. Establish Partnership
      await this.prisma.partner.create({
        data: {
          ownerCompanyId: sellerComp.id,
          partnerCompanyId: buyerComp.id,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });
      // Mirror partnership
      await this.prisma.partner.create({
        data: {
          ownerCompanyId: buyerComp.id,
          partnerCompanyId: sellerComp.id,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });

      this.logger.log('Partnership established.');

      // 4. Create Warehouses
      const sellerWH = await this.prisma.warehouse.create({
        data: { companyId: sellerComp.id, name: 'Seller Main WH' },
      });
      const buyerWH = await this.prisma.warehouse.create({
        data: { companyId: buyerComp.id, name: 'Buyer Main WH' },
      });

      // 5. Create Products
      const sellerProduct = await this.prisma.product.create({
        data: {
          companyId: sellerComp.id,
          name: 'Shakar',
          variants: {
            create: {
              companyId: sellerComp.id,
              name: '50kg qop',
              sku: 'SH-50',
              barcode: '888888',
              salePrice: 500000,
            },
          },
        },
        include: { variants: true },
      });
      const sellerVariant = sellerProduct.variants[0];

      const buyerProduct = await this.prisma.product.create({
        data: {
          companyId: buyerComp.id,
          name: 'Shakar',
          variants: {
            create: {
              companyId: buyerComp.id,
              name: 'Shakar qop 50kg',
              sku: 'B-SH-50',
              salePrice: 550000,
            },
          },
        },
        include: { variants: true },
      });
      const buyerVariant = buyerProduct.variants[0];

      this.logger.log('Products created.');

      // 6. Create Product Mappings (Both sides)
      // Seller's side: Maps Buyer's name to Seller's variant
      await this.prisma.productMapping.create({
        data: {
          companyId: sellerComp.id,
          partnerCompanyId: buyerComp.id,
          partnerProductName: buyerVariant.name, // "Shakar qop 50kg"
          ownProductVariantId: sellerVariant.id,
        },
      });

      // Buyer's side: Maps incoming name (which is their own name in this case) to Buyer's variant
      await this.prisma.productMapping.create({
        data: {
          companyId: buyerComp.id,
          partnerCompanyId: sellerComp.id,
          partnerProductName: buyerVariant.name, 
          ownProductVariantId: buyerVariant.id,
        },
      });

      this.logger.log('Product Mapping created.');

      // 7. Seller Initial Stock
      // Manually add stock for test
      await this.prisma.stockBalance.create({
        data: {
          companyId: sellerComp.id,
          warehouseId: sellerWH.id,
          productVariantId: sellerVariant.id,
          quantity: 100,
        },
      });

      this.logger.log('Seller stock initialized to 100.');

      // 8. Buyer creates and sends Order
      const order = await this.ordersService.createOrder(buyerComp.id, buyerUser.id, {
        sellerCompanyId: sellerComp.id,
        items: [
          {
            productName: buyerVariant.name,
            quantity: 10,
            expectedPrice: 500000,
          },
        ],
      });

      await this.orderWorkflow.sendOrder(order.id, buyerComp.id, buyerUser.id);
      this.logger.log('Order SENT by Buyer.');

      // 9. Seller ACCEPTS Order
      await this.orderWorkflow.acceptOrder(order.id, sellerComp.id, sellerUser.id);
      this.logger.log('Order ACCEPTED by Seller. Auto-mapping performed.');

      // 10. Seller DISPATCHES Order
      const dispatch = await this.dispatchesService.create(sellerComp.id, sellerUser.id, {
        orderId: order.id,
        warehouseId: sellerWH.id,
      });

      await this.dispatchesService.send(dispatch.id, sellerComp.id, sellerUser.id);
      this.logger.log('Order DISPATCHED. Seller stock OUT recorded.');

      // 11. Verify Seller Stock (Should be 90)
      const sellerStock = await this.prisma.stockBalance.findUnique({
        where: { warehouseId_productVariantId: { warehouseId: sellerWH.id, productVariantId: sellerVariant.id } },
      });
      this.logger.log(`Seller Remaining Stock: ${sellerStock?.quantity}`);

      // 12. Buyer Receives and ACCEPTS Goods Receipt
      const receipt = await this.prisma.goodsReceipt.findFirst({
        where: { orderId: order.id, buyerCompanyId: buyerComp.id },
      });

      await this.receiptsAcceptService.accept(receipt!.id, buyerComp.id, buyerUser.id, {
        warehouseId: buyerWH.id,
      });
      this.logger.log('Goods Receipt ACCEPTED by Buyer. Buyer stock IN recorded. Debt created.');

      // 13. Verify Buyer Stock (Should be 10)
      const buyerStock = await this.prisma.stockBalance.findUnique({
        where: { warehouseId_productVariantId: { warehouseId: buyerWH.id, productVariantId: buyerVariant.id } },
      });
      this.logger.log(`Buyer Current Stock: ${buyerStock?.quantity}`);

      // 14. Verify Debt Entry
      const debt = await this.prisma.debtEntry.findFirst({
        where: { receiptId: receipt!.id },
      });
      this.logger.log(`Debt Amount: ${debt?.amount}, Status: ${debt?.status}`);

      // 15. Buyer Pays
      const payment = await this.debtsService.createPaymentRecord(debt!.id, buyerComp.id, buyerUser.id, {
        amount: Number(debt!.amount),
        notes: 'Full payment',
      });
      this.logger.log('Payment Record created by Buyer.');

      // 16. Seller Confirms Payment
      await this.debtsService.confirmPayment(payment.id, sellerComp.id, sellerUser.id);
      this.logger.log('Payment CONFIRMED by Seller.');

      // 17. Final Verification
      const finalDebt = await this.prisma.debtEntry.findUnique({ where: { id: debt!.id } });
      const finalOrder = await this.prisma.b2BOrder.findUnique({ where: { id: order.id } });
      const auditLogsCount = await this.prisma.auditLog.count({
        where: { companyId: { in: [sellerComp.id, buyerComp.id] } },
      });

      const results = {
        sellerStock: sellerStock?.quantity, // 90
        buyerStock: buyerStock?.quantity, // 10
        debtStatus: finalDebt?.status, // PAID
        orderStatus: finalOrder?.status, // COMPLETED
        auditLogsCount,
      };

      this.logger.log('E2E Test Flow Completed Successfully!');
      this.logger.log('Final Results:', results);

      return results;
    } catch (error) {
      this.logger.error('E2E Test Flow FAILED:', error);
      throw error;
    }
  }

  private async cleanup() {
    this.logger.log('Cleaning up old test data...');
    // We can filter by company names if we want to be safe
    const companies = await this.prisma.company.findMany({
      where: { name: { in: ['Azizbek Savdo', 'Baraka Market'] } },
    });
    const ids = companies.map(c => c.id);

    // Order matters for deletion (foreign keys)
    await this.prisma.debtPaymentRecord.deleteMany({ where: { debtEntry: { debtorId: { in: ids } } } });
    await this.prisma.debtEntry.deleteMany({ where: { debtorId: { in: ids } } });
    await this.prisma.goodsReceiptItem.deleteMany({ where: { receipt: { buyerCompanyId: { in: ids } } } });
    await this.prisma.goodsReceipt.deleteMany({ where: { buyerCompanyId: { in: ids } } });
    await this.prisma.dispatchItem.deleteMany({ where: { dispatch: { sellerCompanyId: { in: ids } } } });
    await this.prisma.dispatch.deleteMany({ where: { sellerCompanyId: { in: ids } } });
    await this.prisma.b2BOrderItem.deleteMany({ where: { order: { buyerCompanyId: { in: ids } } } });
    await this.prisma.b2BOrder.deleteMany({ where: { buyerCompanyId: { in: ids } } });
    await this.prisma.productMapping.deleteMany({ where: { companyId: { in: ids } } });
    await this.prisma.stockMovement.deleteMany({ where: { companyId: { in: ids } } });
    await this.prisma.stockBalance.deleteMany({ where: { companyId: { in: ids } } });
    await this.prisma.warehouse.deleteMany({ where: { companyId: { in: ids } } });
    await this.prisma.productVariant.deleteMany({ where: { companyId: { in: ids } } });
    await this.prisma.product.deleteMany({ where: { companyId: { in: ids } } });
    await this.prisma.partner.deleteMany({ where: { ownerCompanyId: { in: ids } } });
    await this.prisma.companyUser.deleteMany({ where: { companyId: { in: ids } } });
    await this.prisma.company.deleteMany({ where: { id: { in: ids } } });
    // Users might be shared, so we handle them carefully or leave them
    await this.prisma.user.deleteMany({ where: { login: { in: ['seller_admin', 'buyer_admin'] } } });

    this.logger.log('Cleanup finished.');
  }

  async seedStockForCompany(companyId: string) {
    this.logger.log(`Seeding stock for company: ${companyId}`);
    
    // 1. Find or Create a warehouse
    let warehouse = await this.prisma.warehouse.findFirst({ where: { companyId } });
    if (!warehouse) {
      warehouse = await this.prisma.warehouse.create({
        data: {
          companyId,
          name: 'Asosiy Ombor (Sistem)',
          status: 'ACTIVE'
        }
      });
      this.logger.log(`Created default warehouse for company: ${companyId}`);
    }

    // 2. Find all variants
    const variants = await this.prisma.productVariant.findMany({ where: { companyId } });
    
    // 3. Upsert stock for each
    for (const variant of variants) {
      await this.prisma.stockBalance.upsert({
        where: {
          warehouseId_productVariantId: {
            warehouseId: warehouse.id,
            productVariantId: variant.id
          }
        },
        update: { quantity: { increment: 1000 } },
        create: {
          companyId,
          warehouseId: warehouse.id,
          productVariantId: variant.id,
          quantity: 1000
        }
      });
    }

    return { success: true, count: variants.length, warehouse: warehouse.name };
  }

  async initializeModules() {
    this.logger.log('Initializing system modules and features...');

    const modules = [
      { key: 'WAREHOUSE', name: 'Ombor' },
      { key: 'B2B', name: 'B2B Savdo' },
      { key: 'PARTNERS', name: 'Hamkorlar' },
      { key: 'PRODUCT_MAPPING', name: 'Mahsulot Mapping' },
      { key: 'DEBT', name: 'Qarz Daftari' },
      { key: 'POS', name: 'POS / Kassa' },
      { key: 'EMPLOYEES', name: 'Xodimlar' },
      { key: 'STOREFRONT', name: 'Onlayn do‘kon' },
      { key: 'EXPENSES', name: 'Ichki xarajatlar' },
      { key: 'REPORTS', name: 'Hisobotlar' },
      { key: 'INTEGRATIONS', name: 'Ulanishlar' },
    ];

    for (const m of modules) {
      const moduleRecord = await (this.prisma as any).module.upsert({
        where: { key: m.key },
        update: { name: m.name },
        create: {
          key: m.key,
          name: m.name,
        },
      });

      // Har bir modul uchun kamida bitta asosiy feature yaratamiz
      await (this.prisma as any).feature.upsert({
        where: { key: `${m.key}_MAIN` },
        update: { name: `${m.name} Asosiy` },
        create: {
          moduleId: moduleRecord.id,
          key: `${m.key}_MAIN`,
          name: `${m.name} Asosiy`,
        },
      });
    }

    return { success: true, count: modules.length };
  }
}
