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
import { ProductMappingsService } from './product-mappings.service';
import { CreateProductMappingDto, UpdateProductMappingDto } from './dto/product-mapping.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('product-mappings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductMappingsController {
  constructor(private readonly productMappingsService: ProductMappingsService) {}

  @Get()
  @Permissions(Permission.PRODUCT_MAPPINGS_VIEW)
  findAll(@CurrentUser() user: any, @Query('partnerCompanyId') partnerCompanyId?: string) {
    return this.productMappingsService.findAll(user.companyId, partnerCompanyId);
  }

  @Get('missing')
  @Permissions(Permission.PRODUCT_MAPPINGS_VIEW)
  getMissing(@CurrentUser() user: any) {
    return this.productMappingsService.getMissingMappings(user.companyId);
  }

  @Get(':id')
  @Permissions(Permission.PRODUCT_MAPPINGS_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.productMappingsService.findOne(user.companyId, id);
  }

  @Post()
  @Permissions(Permission.PRODUCT_MAPPINGS_MANAGE)
  create(@CurrentUser() user: any, @Body() dto: CreateProductMappingDto) {
    return this.productMappingsService.create(user.companyId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(Permission.PRODUCT_MAPPINGS_MANAGE)
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateProductMappingDto) {
    return this.productMappingsService.update(user.companyId, id, user.sub, dto);
  }

  @Delete(':id')
  @Permissions(Permission.PRODUCT_MAPPINGS_MANAGE)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.productMappingsService.remove(user.companyId, id, user.sub);
  }
}
