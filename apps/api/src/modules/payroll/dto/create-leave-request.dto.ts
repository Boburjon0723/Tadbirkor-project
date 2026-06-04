import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsInt()
  @Min(1)
  @Max(60)
  daysCount: number;

  /** YYYY-MM-DD */
  @IsString()
  startDate: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
