import { IsIn, IsOptional, IsString } from 'class-validator';

export class ConfirmPartnerBulkPaymentDto {
  @IsString()
  @IsOptional()
  @IsIn(['UZS', 'USD', 'uzs', 'usd'])
  currency?: string;
}
