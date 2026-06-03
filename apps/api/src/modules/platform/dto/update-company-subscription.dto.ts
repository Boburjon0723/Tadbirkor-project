import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateCompanySubscriptionDto {
  @IsOptional()
  @IsIn(['TRIAL', 'ACTIVE', 'EXPIRED'])
  subscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'EXPIRED';

  /** Sinovni uzaytirish (kun) — status TRIAL bo‘lib qoladi */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  extendTrialDays?: number;

  @IsOptional()
  @IsString()
  subscriptionNote?: string;
}
