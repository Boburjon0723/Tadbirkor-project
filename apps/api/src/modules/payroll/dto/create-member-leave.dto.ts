import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateMemberLeaveDto {
  @IsInt()
  @Min(1)
  @Max(60)
  daysCount: number;

  @IsString()
  startDate: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
