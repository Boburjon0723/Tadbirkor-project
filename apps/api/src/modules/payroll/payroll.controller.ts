import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  Permissions,
  PermissionsAny,
} from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { UpdatePayrollSettingsDto } from './dto/update-payroll-settings.dto';
import { UpdateWorkMonthDto } from './dto/update-work-month.dto';
import { CreateMemberLeaveDto } from './dto/create-member-leave.dto';
import { UpsertPayrollProfileDto } from './dto/upsert-payroll-profile.dto';
import { PayrollLeaveService } from './payroll-leave.service';
import { PayrollDataService } from './payroll-data.service';
import {
  AddPayrollAdvanceDto,
  AddPayrollBonusDto,
  CreatePayrollOnlyMemberDto,
  MarkEmployeeLeftDto,
  UpsertCompensationDto,
  UpsertPayrollEmployeeDto,
  UpsertPayrollSettlementDto,
} from './dto/payroll-employee.dto';

@Controller('payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(
    private readonly payrollLeave: PayrollLeaveService,
    private readonly payrollData: PayrollDataService,
  ) {}

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('settings')
  getSettings(@CurrentUser() user: any) {
    return this.payrollLeave.getSettings(user.companyId);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Patch('settings')
  updateSettings(@CurrentUser() user: any, @Body() dto: UpdatePayrollSettingsDto) {
    return this.payrollLeave.updateSettings(user.companyId, dto.workedDaysMode);
  }

  @PermissionsAny(Permission.PAYROLL_VIEW, Permission.PAYROLL_MANAGE)
  @Get('leave-requests')
  listLeave(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('mine') mine?: string,
  ) {
    return this.payrollLeave.listLeaveRequests(user.companyId, user.sub, {
      status,
      mine: mine === '1' || mine === 'true',
    });
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('leave-requests/pending-count')
  pendingCount(@CurrentUser() user: any) {
    return this.payrollLeave.countPendingLeave(user.companyId, user.sub);
  }

  @PermissionsAny(Permission.PAYROLL_VIEW, Permission.PAYROLL_MANAGE)
  @Post('leave-requests')
  createLeave(@CurrentUser() user: any, @Body() dto: CreateLeaveRequestDto) {
    return this.payrollLeave.createLeaveRequest(user.companyId, user.sub, dto);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Patch('leave-requests/:id/approve')
  approve(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
  ) {
    return this.payrollLeave.approveLeaveRequest(
      user.companyId,
      user.sub,
      id,
      dto.reviewNote,
      'WEB',
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Patch('leave-requests/:id/reject')
  reject(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
  ) {
    return this.payrollLeave.rejectLeaveRequest(
      user.companyId,
      user.sub,
      id,
      dto.reviewNote,
      'WEB',
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('work-months/:companyUserId')
  getWorkMonth(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    return this.payrollLeave.getWorkMonth(user.companyId, companyUserId, y, m);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Patch('work-months/:companyUserId')
  updateWorkMonth(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Body() dto: UpdateWorkMonthDto,
  ) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    return this.payrollLeave.updateWorkMonthManual(
      user.companyId,
      user.sub,
      companyUserId,
      y,
      m,
      dto,
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('members')
  listMembers(@CurrentUser() user: any) {
    return this.payrollLeave.listCompanyMembers(user.companyId);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('members/:companyUserId/leave-requests')
  listMemberLeave(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year ? Number(year) : undefined;
    const m = month ? Number(month) : undefined;
    return this.payrollLeave.listMemberLeaveRequests(
      user.companyId,
      user.sub,
      companyUserId,
      y,
      m,
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('members/:companyUserId/profile')
  getMemberProfile(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
  ) {
    return this.payrollLeave.getPayrollProfile(user.companyId, companyUserId);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Patch('members/:companyUserId/profile')
  upsertMemberProfile(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Body() dto: UpsertPayrollProfileDto,
  ) {
    return this.payrollLeave.upsertPayrollProfile(
      user.companyId,
      user.sub,
      companyUserId,
      dto.monthlyPaidLeaveQuota,
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Post('members/:companyUserId/leave-requests')
  recordMemberLeave(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Body() dto: CreateMemberLeaveDto,
  ) {
    return this.payrollLeave.recordLeaveForMember(
      user.companyId,
      user.sub,
      companyUserId,
      dto,
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('work-months/:companyUserId/approved-leaves')
  approvedLeaves(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    return this.payrollLeave.listApprovedLeaveDays(
      user.companyId,
      companyUserId,
      y,
      m,
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('compensations')
  listCompensations(@CurrentUser() user: any) {
    return this.payrollData.listCompensations(user.companyId);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Post('compensations')
  upsertCompensation(@CurrentUser() user: any, @Body() dto: UpsertCompensationDto) {
    return this.payrollData.upsertCompensation(user.companyId, user.sub, dto);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('employee-extras')
  listEmployeeExtras(@CurrentUser() user: any) {
    return this.payrollData.listEmployeeExtras(user.companyId);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('members/:companyUserId/employee')
  getEmployeeExtra(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
  ) {
    return this.payrollData.getEmployeeExtra(user.companyId, companyUserId);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Patch('members/:companyUserId/employee')
  upsertEmployeeExtra(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Body() dto: UpsertPayrollEmployeeDto,
  ) {
    return this.payrollData.upsertEmployeeExtra(
      user.companyId,
      user.sub,
      companyUserId,
      dto,
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('roster-candidates')
  listRosterCandidates(@CurrentUser() user: any) {
    return this.payrollData.listRosterCandidates(user.companyId);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Post('members/:companyUserId/roster')
  addMemberToRoster(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
  ) {
    return this.payrollData.addMemberToPayrollRoster(
      user.companyId,
      user.sub,
      companyUserId,
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Post('members')
  createPayrollOnlyMember(
    @CurrentUser() user: any,
    @Body() dto: CreatePayrollOnlyMemberDto,
  ) {
    return this.payrollData.createPayrollOnlyMember(user.companyId, user.sub, dto);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Patch('members/:companyUserId/mark-left')
  markEmployeeLeft(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Body() dto: MarkEmployeeLeftDto,
  ) {
    return this.payrollData.markEmployeeLeft(
      user.companyId,
      user.sub,
      companyUserId,
      dto,
    );
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('advances')
  listAdvances(
    @CurrentUser() user: any,
    @Query('companyUserId') companyUserId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    return this.payrollData.listAdvances(user.companyId, companyUserId, y, m);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Post('advances')
  addAdvance(@CurrentUser() user: any, @Body() dto: AddPayrollAdvanceDto) {
    return this.payrollData.addAdvance(user.companyId, user.sub, dto);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Post('bonus')
  addBonus(@CurrentUser() user: any, @Body() dto: AddPayrollBonusDto) {
    return this.payrollData.addBonus(user.companyId, user.sub, dto);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('month-stats')
  getMonthStats(
    @CurrentUser() user: any,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('companyUserIds') companyUserIds?: string,
  ) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    const ids = String(companyUserIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.payrollData.getMonthStats(user.companyId, y, m, ids);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Get('members/:companyUserId/settlement')
  getSettlement(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('defaultBaseSalary') defaultBaseSalary?: string,
  ) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    const base = Number(defaultBaseSalary) || 0;
    return this.payrollData.getSettlement(user.companyId, companyUserId, y, m, base);
  }

  @Permissions(Permission.PAYROLL_MANAGE)
  @Patch('members/:companyUserId/settlement')
  upsertSettlement(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Body() dto: UpsertPayrollSettlementDto,
  ) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    return this.payrollData.upsertSettlement(
      user.companyId,
      user.sub,
      companyUserId,
      y,
      m,
      dto,
    );
  }
}
