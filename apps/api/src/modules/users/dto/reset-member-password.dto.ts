import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetMemberPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Parol kamida 6 belgidan iborat bo‘lishi kerak' })
  newPassword: string;
}
