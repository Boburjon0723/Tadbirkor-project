import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  Patch,
  UseGuards,
  Delete
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnerRequestDto, PartnerWarehouseVisibilityDto } from './dto/partner.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('partners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @Permissions(Permission.PARTNERS_VIEW)
  findAll(@CurrentUser() user: any) {
    return this.partnersService.findAll(user.companyId);
  }

  @Get('search-company/:tin')
  @Permissions(Permission.PARTNERS_MANAGE)
  searchCompany(@Param('tin') tin: string) {
    return this.partnersService.searchCompany(tin);
  }

  @Post('request')
  @Permissions(Permission.PARTNERS_MANAGE)
  requestPartner(@CurrentUser() user: any, @Body() dto: PartnerRequestDto) {
    return this.partnersService.requestPartner(user.companyId, dto, user.sub);
  }

  @Patch(':id/accept')
  @Permissions(Permission.PARTNERS_MANAGE)
  acceptRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.partnersService.acceptRequest(user.companyId, id, user.sub);
  }

  @Patch(':id/reject')
  @Permissions(Permission.PARTNERS_MANAGE)
  rejectRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.partnersService.rejectRequest(user.companyId, id, user.sub);
  }

  @Patch(':id/block')
  @Permissions(Permission.PARTNERS_MANAGE)
  blockPartner(@CurrentUser() user: any, @Param('id') id: string) {
    return this.partnersService.blockPartner(user.companyId, id, user.sub);
  }

  @Patch(':id/warehouse-visibility')
  @Permissions(Permission.PARTNERS_MANAGE)
  updateWarehouseVisibility(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: PartnerWarehouseVisibilityDto,
  ) {
    return this.partnersService.updateWarehouseVisibility(user.companyId, id, user.sub, dto);
  }

  @Delete(':id')
  @Permissions(Permission.PARTNERS_MANAGE)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.partnersService.remove(user.companyId, id, user.sub);
  }

  @Get(':id')
  @Permissions(Permission.PARTNERS_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.partnersService.findOne(user.companyId, id);
  }
}
