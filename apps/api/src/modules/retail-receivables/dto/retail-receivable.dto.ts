import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordReceivablePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListReceivablesQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  retailCustomerId?: string;
}
