import { Controller, Post, Get, Body, UseGuards, Patch } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import {
  CreateOnboardingCompanyDto,
  SubmitBusinessAnswersDto,
  AddTeamMemberDto,
  UpdateOnboardingCompanyDto,
} from './dto/onboarding.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type AuthUser = { sub: string; companyId?: string };

@Controller('onboarding')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(Permission.SETTINGS_MANAGE)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('company')
  async createCompany(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOnboardingCompanyDto,
  ) {
    return this.onboardingService.createCompany(user.sub, dto);
  }

  @Patch('company')
  async updateCompany(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOnboardingCompanyDto,
  ) {
    return this.onboardingService.updateCompanyProfile(
      user.companyId,
      user.sub,
      dto,
    );
  }

  @Post('business-answers')
  async submitAnswers(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitBusinessAnswersDto,
  ) {
    return this.onboardingService.applyModules(
      user.companyId,
      user.sub,
      dto,
    );
  }

  @Post('team')
  async addTeamMember(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.onboardingService.addTeamMember(
      user.companyId,
      user.sub,
      dto,
    );
  }

  @Post('complete')
  async completeOnboarding(@CurrentUser() user: AuthUser) {
    return this.onboardingService.completeOnboarding(
      user.companyId,
      user.sub,
    );
  }

  @Get('status')
  async getStatus(@CurrentUser() user: AuthUser) {
    return this.onboardingService.getOnboardingStatus(
      user.companyId,
      user.sub,
    );
  }
}
