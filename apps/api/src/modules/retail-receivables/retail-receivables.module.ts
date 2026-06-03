import { Module } from '@nestjs/common';
import { RetailReceivablesService } from './retail-receivables.service';
import { RetailReceivablesController } from './retail-receivables.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompaniesModule } from '../companies/companies.module';
import { AuthModule } from '../auth/auth.module';
import { RetailCustomersModule } from '../retail-customers/retail-customers.module';

@Module({
  imports: [PrismaModule, CompaniesModule, AuthModule, RetailCustomersModule],
  controllers: [RetailReceivablesController],
  providers: [RetailReceivablesService],
  exports: [RetailReceivablesService],
})
export class RetailReceivablesModule {}
