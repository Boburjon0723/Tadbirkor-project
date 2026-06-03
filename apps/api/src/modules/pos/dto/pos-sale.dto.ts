import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PosSaleItemInputDto {
  @IsString()
  @IsNotEmpty()
  productVariantId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  /** Agar berilmasa, variant.salePrice ishlatiladi. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;
}

export class CreatePosSaleDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemInputDto)
  @IsOptional()
  items?: PosSaleItemInputDto[];

  /** Umumiy chek bo'yicha summa chegirmasi (UZS). */
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  retailCustomerId?: string;

  /** Mehmon / tez ism (chekda) */
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;
}

export class UpdatePosSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemInputDto)
  @IsOptional()
  items?: PosSaleItemInputDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  retailCustomerId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;
}

/** Bitta so‘rovda chek yaratish + to‘lov (POS tezligi uchun). */
export class QuickCheckoutPosSaleDto extends CreatePosSaleDto {
  @IsString()
  @IsIn(['CASH', 'CARD', 'CREDIT'])
  method: 'CASH' | 'CARD' | 'CREDIT';

  @IsNumber()
  @Min(0)
  @IsOptional()
  cashReceived?: number;
}

export class CheckoutPosSaleDto {
  @IsString()
  @IsIn(['CASH', 'CARD', 'CREDIT'])
  method: 'CASH' | 'CARD' | 'CREDIT';

  /** Faqat CASH: mijoz bergan naqd. CARD/CREDIT da ishlatilmaydi. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  cashReceived?: number;

  @IsString()
  @IsOptional()
  retailCustomerId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;
}

export class VoidPosSaleDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ListPosSalesQueryDto {
  @IsString()
  @IsOptional()
  @IsIn(['DRAFT', 'COMPLETED', 'VOIDED'])
  status?: 'DRAFT' | 'COMPLETED' | 'VOIDED';

  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  cashierId?: string;

  /** ISO date (YYYY-MM-DD) — shu sanadagi (kompaniya local timezonesiz UTC) sotuvlar. */
  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}
