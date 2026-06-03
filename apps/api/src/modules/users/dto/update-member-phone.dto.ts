import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateMemberPhoneDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}
