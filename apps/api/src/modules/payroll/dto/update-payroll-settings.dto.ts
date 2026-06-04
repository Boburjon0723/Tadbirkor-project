import { IsIn, IsString } from 'class-validator';

export class UpdatePayrollSettingsDto {
  @IsString()
  @IsIn(['AUTO', 'MANUAL'])
  workedDaysMode: 'AUTO' | 'MANUAL';
}
