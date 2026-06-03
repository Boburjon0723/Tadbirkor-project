import { IsNotEmpty, IsNumber, Min, IsString, IsOptional } from "class-validator";

export class CreatePaymentRecordDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
}
