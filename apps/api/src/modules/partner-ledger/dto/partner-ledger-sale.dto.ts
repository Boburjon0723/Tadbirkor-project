import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const PARTNER_LEDGER_SETTLEMENT_TYPES = [
  'on_credit',
  'cash',
  'card',
  'barter',
  'partial',
  'promised',
] as const;

export class PartnerLedgerSaleLineDto {
  @IsString()
  @IsNotEmpty()
  productVariantId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;
}

export class CreatePartnerLedgerSaleOrderDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PartnerLedgerSaleLineDto)
  lines: PartnerLedgerSaleLineDto[];

  @IsOptional()
  @IsString()
  operationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn([...PARTNER_LEDGER_SETTLEMENT_TYPES])
  settlementType?: (typeof PARTNER_LEDGER_SETTLEMENT_TYPES)[number];

  @IsOptional()
  @IsString()
  settlementNote?: string;
}
