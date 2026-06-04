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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(
    private readonly payrollLeave: PayrollLeaveService,
    private readonly payrollData: PayrollDataService,
  ) {}

  @Get('settings')
  getSettings(@CurrentUser() user: any) {
    return this.payrollLeave.getSettings(user.companyId);
  }

  @Patch('settings')
  updateSettings(@CurrentUser() user: any, @Body() dto: UpdatePayrollSettingsDto) {
    return this.payrollLeave.updateSettings(user.companyId, dto.workedDaysMode);
  }

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

  @Get('leave-requests/pending-count')
  pendingCount(@CurrentUser() user: any) {
    return this.payrollLeave.countPendingLeave(user.companyId, user.sub);
  }

  @Post('leave-requests')
  createLeave(@CurrentUser() user: any, @Body() dto: CreateLeaveRequestDto) {
    return this.payrollLeave.createLeaveRequest(user.companyId, user.sub, dto);
  }

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

  @Get('members')
  listMembers(@CurrentUser() user: any) {
    return this.payrollLeave.listCompanyMembers(user.companyId);
  }

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

  @Get('members/:companyUserId/profile')
  getMemberProfile(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
  ) {
    return this.payrollLeave.getPayrollProfile(user.companyId, companyUserId);
  }

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

  @Get('compensations')
  listCompensations(@CurrentUser() user: any) {
    return this.payrollData.listCompensations(user.companyId);
  }

  @Post('compensations')
  upsertCompensation(@CurrentUser() user: any, @Body() dto: UpsertCompensationDto) {
    return this.payrollData.upsertCompensation(user.companyId, user.sub, dto);
  }

  @Get('employee-extras')
  listEmployeeExtras(@CurrentUser() user: any) {
    return this.payrollData.listEmployeeExtras(user.companyId);
  }

  @Get('members/:companyUserId/employee')
  getEmployeeExtra(
    @CurrentUser() user: any,
    @Param('companyUserId') companyUserId: string,
  ) {
    return this.payrollData.getEmployeeExtra(user.companyId, companyUserId);
  }

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

  @Get('roster-candidates')
  listRosterCandidates(@CurrentUser() user: any) {
    return this.payrollData.listRosterCandidates(user.companyId);
  }

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

  @Post('members')
  createPayrollOnlyMember(
    @CurrentUser() user: any,
    @Body() dto: CreatePayrollOnlyMemberDto,
  ) {
    return this.payrollData.createPayrollOnlyMember(user.companyId, user.sub, dto);
  }

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

  @Post('advances')
  addAdvance(@CurrentUser() user: any, @Body() dto: AddPayrollAdvanceDto) {
    return this.payrollData.addAdvance(user.companyId, user.sub, dto);
  }

  @Post('bonus')
  addBonus(@CurrentUser() user: any, @Body() dto: AddPayrollBonusDto) {
    return this.payrollData.addBonus(user.companyId, user.sub, dto);
  }

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
