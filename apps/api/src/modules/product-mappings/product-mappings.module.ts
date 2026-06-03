import { Module } from '@nestjs/common';
import { ProductMappingsService } from './product-mappings.service';
import { ProductMappingsController } from './product-mappings.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PartnersModule } from '../partners/partners.module';

@Module({
  imports: [PrismaModule, AuthModule, PartnersModule],
  controllers: [ProductMappingsController],
  providers: [ProductMappingsService],
  exports: [ProductMappingsService],
})
export class ProductMappingsModule {}
