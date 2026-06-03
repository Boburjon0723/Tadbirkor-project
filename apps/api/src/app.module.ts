import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { PrismaModule } from './prisma/prisma.module';
import { AppCacheModule } from './common/cache/app-cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { PartnersModule } from './modules/partners/partners.module';
import { ProductMappingsModule } from './modules/product-mappings/product-mappings.module';
import { B2BOrdersModule } from './modules/b2b-orders/b2b-orders.module';
import { DebtsModule } from './modules/debts/debts.module';
import { DispatchesModule } from './modules/dispatches/dispatches.module';
import { GoodsReceiptsModule } from './modules/goods-receipts/goods-receipts.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SystemModule } from './modules/system/system.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { SupportModule } from './modules/support/support.module';
import { PosModule } from './modules/pos/pos.module';
import { FieldModule } from './modules/field/field.module';
import { RetailCustomersModule } from './modules/retail-customers/retail-customers.module';
import { RetailReceivablesModule } from './modules/retail-receivables/retail-receivables.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { PartnerLedgerModule } from './modules/partner-ledger/partner-ledger.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SubscriptionGuard } from './common/guards/subscription.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppCacheModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    OnboardingModule,
    WarehousesModule,
    PartnersModule,
    ProductMappingsModule,
    B2BOrdersModule,
    DebtsModule,
    DispatchesModule,
    GoodsReceiptsModule,
    DashboardModule,
    ReportsModule,
    SystemModule,
    NotificationsModule,
    AuditLogsModule,
    PdfModule,
    InvoicesModule,
    CompaniesModule,
    UploadsModule,
    TasksModule,
    WorkflowsModule,
    TelegramModule,
    SupportModule,
    PosModule,
    FieldModule,
    RetailCustomersModule,
    RetailReceivablesModule,
    ExpensesModule,
    PartnerLedgerModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
})
export class AppModule {}
