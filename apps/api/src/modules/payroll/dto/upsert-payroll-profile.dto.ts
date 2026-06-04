import { IsInt, Max, Min } from 'class-validator';

export class UpsertPayrollProfileDto {
  @IsInt()
  @Min(0)
  @Max(10)
  monthlyPaidLeaveQuota: number;
}
