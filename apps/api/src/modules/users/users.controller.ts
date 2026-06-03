import {
  Controller,
  Get,
  UseGuards,
  Request,
  Patch,
  Body,
  Param,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { WarehouseScopeService } from './services/warehouse-scope.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { ResetMemberPasswordDto } from './dto/reset-member-password.dto';
import { UpdateMemberPhoneDto } from './dto/update-member-phone.dto';
import { CompaniesService } from '../companies/companies.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly warehouseScopeService: WarehouseScopeService,
    private readonly companiesService: CompaniesService,
  ) {}

  @Get('roles/catalog')
  getRolesCatalog() {
    return this.usersService.getRolesCatalog();
  }

  @Get('company')
  @Permissions(Permission.USERS_MANAGE)
  async getCompanyUsers(@Request() req: any) {
    await this.companiesService.assertModuleEnabled(req.user.companyId, 'EMPLOYEES');
    return this.usersService.findByCompany(req.user.companyId);
  }

  @Patch('company/members/:membershipId/role')
  @Permissions(Permission.USERS_MANAGE)
  async updateMemberRole(
    @Request() req: any,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    await this.companiesService.assertModuleEnabled(req.user.companyId, 'EMPLOYEES');
    return this.usersService.updateMemberRole(
      req.user.companyId,
      membershipId,
      dto.role,
      dto.warehouseId ?? null,
      dto.grantPermissions,
      dto.denyPermissions,
    );
  }

  @Patch('company/members/:membershipId/password')
  @Permissions(Permission.USERS_MANAGE)
  async resetMemberPassword(
    @Request() req: any,
    @Param('membershipId') membershipId: string,
    @Body() dto: ResetMemberPasswordDto,
  ) {
    await this.companiesService.assertModuleEnabled(req.user.companyId, 'EMPLOYEES');
    return this.usersService.resetMemberPassword(
      req.user.companyId,
      membershipId,
      dto.newPassword,
    );
  }

  @Patch('company/members/:membershipId/phone')
  @Permissions(Permission.USERS_MANAGE)
  async updateMemberPhone(
    @Request() req: any,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberPhoneDto,
  ) {
    await this.companiesService.assertModuleEnabled(req.user.companyId, 'EMPLOYEES');
    return this.usersService.updateMemberPhone(
      req.user.companyId,
      membershipId,
      dto.phone,
    );
  }

  @Delete('company/members/:membershipId')
  @Permissions(Permission.USERS_MANAGE)
  async removeMember(
    @Request() req: any,
    @Param('membershipId') membershipId: string,
  ) {
    await this.companiesService.assertModuleEnabled(req.user.companyId, 'EMPLOYEES');
    return this.usersService.removeMemberFromCompany(
      req.user.companyId,
      membershipId,
      req.user.sub,
    );
  }

  @Get('me/warehouse-scope')
  getMyWarehouseScope(@Request() req: any) {
    return this.warehouseScopeService.getForUser(req.user.companyId, req.user.sub);
  }

  @Patch('me/password')
  updateMePassword(@Request() req: any, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }
}
