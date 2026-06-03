import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RemoveTelegramBindingDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['OWNER', 'MANAGER', 'WAREHOUSE', 'ACCOUNTANT', 'SALES'])
  role: string;

  @IsString()
  @IsNotEmpty()
  moduleKey: string;
}
