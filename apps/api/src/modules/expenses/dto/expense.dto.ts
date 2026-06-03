import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  categoryId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsIn(['UZS', 'USD'])
  currency?: string;

  @IsString()
  @IsNotEmpty()
  expenseDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsIn(['UZS', 'USD'])
  currency?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectExpenseDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
