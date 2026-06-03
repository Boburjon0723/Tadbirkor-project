import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ProductExportQueryDto {
  @IsUUID()
  warehouseId: string;

  /** with_stock = joriy qoldiq yoziladi; without_stock = qoldiq ustuni bo'sh */
  @IsOptional()
  @IsIn(['with_stock', 'without_stock'])
  mode?: 'with_stock' | 'without_stock' = 'with_stock';
}
