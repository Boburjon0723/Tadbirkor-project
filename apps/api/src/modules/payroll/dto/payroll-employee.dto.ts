import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertCompensationDto {
  @IsString()
  @IsNotEmpty()
  companyUserId: string;

  @IsString()
  @IsNotEmpty()
  employeeName: string;

  @IsString()
  @IsNotEmpty()
  employeeRole: string;

  @IsNumber()
  @Min(0)
  baseSalary: number;

  @IsEnum(['UZS', 'USD'])
  @IsOptional()
  currency?: 'UZS' | 'USD';

  @IsString()
  @IsOptional()
  effectiveFrom?: string;
}

export class UpsertPayrollEmployeeDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  monthlyPaidLeaveQuota?: number;

  @IsString()
  @IsOptional()
  leftAt?: string | null;

  @IsEnum(['ACTIVE', 'LEAVE', 'LEFT'])
  @IsOptional()
  employmentStatus?: 'ACTIVE' | 'LEAVE' | 'LEFT';
}

export class CreatePayrollOnlyMemberDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  baseSalary: number;

  @IsEnum(['UZS', 'USD'])
  @IsOptional()
  currency?: 'UZS' | 'USD';

  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  monthlyPaidLeaveQuota?: number;
}

export class AddPayrollAdvanceDto {
  @IsString()
  @IsNotEmpty()
  companyUserId: string;

  @IsInt()
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  advanceDate?: string;
}

export class AddPayrollBonusDto {
  @IsString()
  @IsNotEmpty()
  companyUserId: string;

  @IsInt()
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpsertPayrollSettlementDto {
  @IsNumber()
  @Min(0)
  baseSalary: number;

  @IsInt()
  @Min(1)
  totalDays: number;

  @IsInt()
  @Min(0)
  workedDays: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bonus?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  penalties?: number;

  @IsOptional()
  confirmPayment?: boolean;
}

export class MarkEmployeeLeftDto {
  @IsString()
  @IsNotEmpty()
  leftAt: string;
}
