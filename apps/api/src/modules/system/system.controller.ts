import { Controller, Post, UseGuards } from '@nestjs/common';
import { TestFlowService } from './test-flow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { SystemDevGuard } from './system-dev.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('system')
@UseGuards(JwtAuthGuard, PermissionsGuard, SystemDevGuard)
export class SystemController {
  constructor(private readonly testFlowService: TestFlowService) {}

  @Post('test-e2e')
  @Permissions(Permission.SETTINGS_MANAGE)
  runTest() {
    return this.testFlowService.runE2EFlow();
  }

  @Post('seed-stock')
  @Permissions(Permission.WAREHOUSE_ADJUST)
  seedStock(@CurrentUser() user: { companyId: string }) {
    return this.testFlowService.seedStockForCompany(user.companyId);
  }

  @Post('init-modules')
  @Permissions(Permission.SETTINGS_MANAGE)
  initModules() {
    return this.testFlowService.initializeModules();
  }
}
