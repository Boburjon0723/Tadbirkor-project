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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('product-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Permissions(Permission.PRODUCTS_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.companyId, dto);
  }

  @Get()
  @Permissions(Permission.PRODUCTS_VIEW)
  findAll(@CurrentUser() user: any, @Query('warehouseId') warehouseId?: string) {
    return this.categoriesService.findAll(user.companyId, { warehouseId });
  }

  @Get(':id')
  @Permissions(Permission.PRODUCTS_VIEW)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.categoriesService.findOne(id, user.companyId);
  }

  @Patch(':id')
  @Permissions(Permission.PRODUCTS_UPDATE)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  @Permissions(Permission.PRODUCTS_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.categoriesService.remove(id, user.companyId);
  }
}
