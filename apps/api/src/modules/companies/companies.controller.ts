import { Controller, Get, Body, Patch, Post, Delete, UseGuards, Request } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { UpdateWarehouseBundleDto } from './dto/update-warehouse-bundle.dto';
import { UpsertTelegramBindingDto } from './dto/upsert-telegram-binding.dto';
import { RemoveTelegramBindingDto } from './dto/remove-telegram-binding.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  @Permissions(Permission.SETTINGS_MANAGE) // Changed from SYSTEM_ACCESS
  getMe(@Request() req: any) {
    return this.companiesService.findOne(req.user.companyId);
  }

  @Get('features')
  async getFeatures(@CurrentUser() user: { sub: string; companyId?: string }) {
    const companyId = await this.companiesService.resolveCompanyIdForUser(
      user.sub,
      user.companyId,
    );
    return this.companiesService.getFeatureConfig(companyId);
  }

  @Get('pos-settings')
  @Permissions(Permission.POS_VIEW)
  getPosSettings(@Request() req: any) {
    return this.companiesService.getPosSettings(req.user.companyId);
  }

  @Patch('features')
  @Permissions(Permission.SETTINGS_MANAGE)
  updateFeatures(@Request() req: any, @Body() dto: UpdateFeatureDto) {
    return this.companiesService.updateFeatureConfig(req.user.companyId, dto);
  }

  /** Ombor guruhlari: core | b2b_outbound | inventory_count | all */
  @Patch('features/warehouse-bundle')
  @Permissions(Permission.SETTINGS_MANAGE)
  updateWarehouseBundle(@Request() req: any, @Body() dto: UpdateWarehouseBundleDto) {
    return this.companiesService.updateWarehouseBundle(
      req.user.companyId,
      dto.bundleId.trim(),
      dto.enabled,
    );
  }

  @Patch('me')
  @Permissions(Permission.SETTINGS_MANAGE) // Only for owners/managers
  update(@Request() req: any, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(req.user.companyId, dto);
  }

  @Patch('me/storefront-token')
  @Permissions(Permission.SETTINGS_MANAGE)
  regenerateStorefrontToken(@Request() req: any) {
    return this.companiesService.regenerateStorefrontToken(req.user.companyId);
  }

  @Post('me/telegram-link/init')
  @Permissions(Permission.SETTINGS_MANAGE)
  initTelegramLink(@Request() req: any) {
    return this.companiesService.initTelegramLink(req.user.companyId, req.user.sub);
  }

  @Get('me/telegram-bindings')
  @Permissions(Permission.SETTINGS_MANAGE)
  getTelegramBindings(@Request() req: any) {
    return this.companiesService.getTelegramBindings(req.user.companyId);
  }

  @Patch('me/telegram-bindings')
  @Permissions(Permission.SETTINGS_MANAGE)
  upsertTelegramBinding(@Request() req: any, @Body() dto: UpsertTelegramBindingDto) {
    return this.companiesService.upsertTelegramBinding(req.user.companyId, dto);
  }

  @Delete('me/telegram-bindings')
  @Permissions(Permission.SETTINGS_MANAGE)
  removeTelegramBinding(@Request() req: any, @Body() dto: RemoveTelegramBindingDto) {
    return this.companiesService.removeTelegramBinding(req.user.companyId, dto);
  }
}
