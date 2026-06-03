import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query,
  UseGuards 
} from '@nestjs/common';
import { VariantsService } from './variants.service';
import { CreateVariantDto, UpdateVariantDto, UpdatePriceDto } from './dto/variant.dto';
import { PublishVariantDto } from './dto/publish-variant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('product-variants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Get()
  @Permissions(Permission.PRODUCTS_VIEW)
  findAll(@CurrentUser() user: any) {
    return this.variantsService.findAll(user.companyId);
  }

  @Get('search')
  @Permissions(Permission.PRODUCTS_VIEW)
  search(
    @CurrentUser() user: any, 
    @Query('query') query?: string,
    @Query('barcode') barcode?: string,
    @Query('sku') sku?: string,
  ) {
    return this.variantsService.search(user.companyId, { query, barcode, sku });
  }

  @Get(':id')
  @Permissions(Permission.PRODUCTS_VIEW)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.variantsService.findOne(id, user.companyId);
  }

  @Post('product/:productId')
  @Permissions(Permission.PRODUCTS_CREATE)
  create(
    @Param('productId') productId: string,
    @CurrentUser() user: any, 
    @Body() dto: CreateVariantDto
  ) {
    return this.variantsService.create(user.companyId, productId, dto, user.sub);
  }

  @Patch(':id')
  @Permissions(Permission.PRODUCTS_UPDATE)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateVariantDto) {
    return this.variantsService.update(id, user.companyId, dto, user.sub);
  }

  @Patch(':id/price')
  @Permissions(Permission.PRODUCTS_UPDATE_PRICE)
  updatePrice(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdatePriceDto) {
    return this.variantsService.updatePrice(id, user.companyId, dto, user.sub);
  }

  @Patch(':id/publish')
  @Permissions(Permission.PRODUCTS_UPDATE)
  publishToWebsite(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: PublishVariantDto) {
    return this.variantsService.publishToWebsite(id, user.companyId, dto, user.sub);
  }

  @Delete(':id')
  @Permissions(Permission.PRODUCTS_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.variantsService.remove(id, user.companyId, user.sub);
  }
}
