import { Module } from '@nestjs/common';
import { RetailCustomersService } from './retail-customers.service';
import { RetailCustomersController } from './retail-customers.controller';
import { RetailCustomerLedgerService } from './retail-customer-ledger.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompaniesModule } from '../companies/companies.module';
import { AuthModule } from '../auth/auth.module';
import { AppCacheModule } from '../../common/cache/app-cache.module';

@Module({
  imports: [PrismaModule, CompaniesModule, AuthModule, AppCacheModule],
  controllers: [RetailCustomersController],
  providers: [RetailCustomersService, RetailCustomerLedgerService],
  exports: [RetailCustomersService, RetailCustomerLedgerService],
})
export class RetailCustomersModule {}
