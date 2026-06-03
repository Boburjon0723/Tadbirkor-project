import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { PartnerLedgerController } from './partner-ledger.controller';
import { PartnerLedgerLinkService } from './partner-ledger-link.service';
import { PartnerLedgerExcelService } from './partner-ledger-excel.service';
import { PartnerLedgerSaleService } from './partner-ledger-sale.service';
import { PartnerLedgerService } from './partner-ledger.service';

@Module({
  imports: [PrismaModule, forwardRef(() => WarehousesModule)],
  controllers: [PartnerLedgerController],
  providers: [
    PartnerLedgerService,
    PartnerLedgerLinkService,
    PartnerLedgerSaleService,
    PartnerLedgerExcelService,
  ],
  exports: [
    PartnerLedgerService,
    PartnerLedgerLinkService,
    PartnerLedgerSaleService,
    PartnerLedgerExcelService,
  ],
})
export class PartnerLedgerModule {}
