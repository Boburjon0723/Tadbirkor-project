import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsDateString, IsIn, ArrayMaxSize } from "class-validator";
import { Type } from "class-transformer";
import { B2B_ORDER_MAX_LINE_ITEMS } from '../b2b-order.limits';

class CreateB2BOrderItemDto {
  @IsString()
  @IsOptional()
  productVariantId?: string; // Optional for buyer if they don't know seller's variant yet

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @IsOptional()
  expectedPrice?: number;

  @IsString()
  @IsOptional()
  @IsIn(['UZS', 'USD'])
  expectedCurrency?: 'UZS' | 'USD';
}

export class CreateB2BOrderDto {
  @IsString()
  @IsNotEmpty()
  sellerCompanyId: string;

  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ArrayMaxSize(B2B_ORDER_MAX_LINE_ITEMS, {
    message: `Bitta buyurtmada ${B2B_ORDER_MAX_LINE_ITEMS} tadan ortiq mahsulot bo‘lishi mumkin emas`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateB2BOrderItemDto)
  items: CreateB2BOrderItemDto[];
}

/** Faqat DRAFT; sotuvchi o‘zgarmaydi. */
export class UpdateDraftB2BOrderDto {
  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ArrayMaxSize(B2B_ORDER_MAX_LINE_ITEMS, {
    message: `Bitta buyurtmada ${B2B_ORDER_MAX_LINE_ITEMS} tadan ortiq mahsulot bo‘lishi mumkin emas`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateB2BOrderItemDto)
  items: CreateB2BOrderItemDto[];
}

export class MapIncomingOrderItemDto {
  @IsString()
  @IsNotEmpty()
  ownProductVariantId: string;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  sellerPrice?: number;

  @IsString()
  @IsOptional()
  @IsIn(['UZS', 'USD'])
  sellerCurrency?: 'UZS' | 'USD';
}
