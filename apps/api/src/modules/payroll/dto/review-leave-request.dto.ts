import { IsOptional, IsString } from 'class-validator';

export class ReviewLeaveRequestDto {
  @IsString()
  @IsOptional()
  reviewNote?: string;
}
