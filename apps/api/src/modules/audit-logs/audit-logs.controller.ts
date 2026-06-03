import { Controller, Get, Query, UseGuards, Request, Param } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async getLogs(@Request() req: any, @Query() query: any) {
    return this.auditLogsService.findAll(req.user.companyId, query);
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.auditLogsService.getStats(req.user.companyId);
  }

  @Get(':id')
  async getLogDetail(@Param('id') id: string, @Request() req: any) {
    return this.auditLogsService.findOne(id, req.user.companyId);
  }
}
