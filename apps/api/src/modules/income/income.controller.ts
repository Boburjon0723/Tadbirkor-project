import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { effectivePermissions } from '../../common/role-permissions';
import { CreateIncomeCategoryDto, UpdateIncomeCategoryDto } from './dto/income-category.dto';
import { CreateIncomeDto, UpdateIncomeDto } from './dto/income.dto';
import { IncomeService } from './income.service';

@Controller('income')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  private canManage(user: { role: string }) {
    const perms = effectivePermissions(user.role);
    return perms.includes(Permission.INCOME_MANAGE);
  }

  @Get('categories')
  @Permissions(Permission.INCOME_VIEW)
  listCategories(@CurrentUser() user: any) {
    return this.incomeService.listCategories(user.companyId);
  }

  @Post('categories')
  @Permissions(Permission.INCOME_MANAGE)
  createCategory(@CurrentUser() user: any, @Body() dto: CreateIncomeCategoryDto) {
    return this.incomeService.createCategory(user.companyId, dto);
  }

  @Patch('categories/:id')
  @Permissions(Permission.INCOME_MANAGE)
  updateCategory(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateIncomeCategoryDto,
  ) {
    return this.incomeService.updateCategory(user.companyId, id, dto);
  }

  @Get()
  @Permissions(Permission.INCOME_VIEW)
  findAll(
    @CurrentUser() user: any,
    @Query('categoryId') categoryId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.incomeService.findAll(user.companyId, {
      categoryId,
      from,
      to,
      search,
      page,
      limit,
    });
  }

  @Get(':id')
  @Permissions(Permission.INCOME_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incomeService.findOne(user.companyId, id);
  }

  @Post()
  @Permissions(Permission.INCOME_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreateIncomeDto) {
    return this.incomeService.create(user.companyId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(Permission.INCOME_CREATE)
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateIncomeDto) {
    return this.incomeService.update(user.companyId, user.sub, id, dto, this.canManage(user));
  }

  @Delete(':id')
  @Permissions(Permission.INCOME_CREATE)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incomeService.remove(user.companyId, user.sub, id, this.canManage(user));
  }
}
