import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PARTNER_LEDGER_OPERATION_TYPES } from '../partner-ledger.types';

export class CreatePartnerLedgerContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePartnerLedgerContactDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  isActive?: boolean;
}

export class CreatePartnerLedgerOperationDto {
  @IsIn([...PARTNER_LEDGER_OPERATION_TYPES])
  type: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsIn(['UZS', 'USD'])
  currency?: string;

  @IsString()
  @IsNotEmpty()
  operationDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePartnerLedgerOperationDto {
  @IsOptional()
  @IsIn([...PARTNER_LEDGER_OPERATION_TYPES])
  type?: string;

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
  operationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
