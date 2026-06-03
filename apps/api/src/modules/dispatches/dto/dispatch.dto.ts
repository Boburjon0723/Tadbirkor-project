import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDispatchDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string; // Warehouse to take stock FROM
}
