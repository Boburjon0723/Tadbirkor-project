import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductImportService } from './product-import.service';
import { ProductsController } from './products.controller';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { VariantsService } from './variants.service';
import { VariantsController } from './variants.controller';
import { StorefrontController } from './storefront.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { PartnerLedgerModule } from '../partner-ledger/partner-ledger.module';

@Module({
  imports: [PrismaModule, AuthModule, WarehousesModule, PartnerLedgerModule],
  controllers: [ProductsController, CategoriesController, VariantsController, StorefrontController],
  providers: [ProductsService, ProductImportService, CategoriesService, VariantsService],
  exports: [ProductsService, ProductImportService, CategoriesService, VariantsService],
})
export class ProductsModule {}
