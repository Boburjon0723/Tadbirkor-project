import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateWorkMonthDto {
  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  workedDays?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  totalDays?: number;
}
