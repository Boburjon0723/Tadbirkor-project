import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense-category.dto';
import { CreateExpenseDto, RejectExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExpensesService } from './expenses.service';
import { effectivePermissions } from '../../common/role-permissions';

@Controller('expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  private canManage(user: { role: string }) {
    const perms = effectivePermissions(user.role);
    return perms.includes(Permission.EXPENSES_MANAGE);
  }

  @Get('categories')
  @Permissions(Permission.EXPENSES_VIEW)
  listCategories(@CurrentUser() user: any) {
    return this.expensesService.listCategories(user.companyId);
  }

  @Post('categories')
  @Permissions(Permission.EXPENSES_MANAGE)
  createCategory(@CurrentUser() user: any, @Body() dto: CreateExpenseCategoryDto) {
    return this.expensesService.createCategory(user.companyId, dto);
  }

  @Patch('categories/:id')
  @Permissions(Permission.EXPENSES_MANAGE)
  updateCategory(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.expensesService.updateCategory(user.companyId, id, dto);
  }

  @Get('summary')
  @Permissions(Permission.EXPENSES_VIEW)
  summary(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('currency') currency?: string,
  ) {
    return this.expensesService.getSummary(user.companyId, { from, to, currency });
  }

  @Get()
  @Permissions(Permission.EXPENSES_VIEW)
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.expensesService.findAll(user.companyId, {
      status,
      categoryId,
      from,
      to,
      search,
      page,
      limit,
    });
  }

  @Get(':id')
  @Permissions(Permission.EXPENSES_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.expensesService.findOne(user.companyId, id);
  }

  @Post()
  @Permissions(Permission.EXPENSES_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user.companyId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(Permission.EXPENSES_CREATE)
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(
      user.companyId,
      user.sub,
      id,
      dto,
      this.canManage(user),
    );
  }

  @Post(':id/approve')
  @Permissions(Permission.EXPENSES_APPROVE)
  approve(@CurrentUser() user: any, @Param('id') id: string) {
    return this.expensesService.approve(user.companyId, user.sub, id);
  }

  @Post(':id/reject')
  @Permissions(Permission.EXPENSES_REJECT)
  reject(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: RejectExpenseDto) {
    return this.expensesService.reject(user.companyId, user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.EXPENSES_CREATE)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.expensesService.remove(user.companyId, user.sub, id, this.canManage(user));
  }
}
