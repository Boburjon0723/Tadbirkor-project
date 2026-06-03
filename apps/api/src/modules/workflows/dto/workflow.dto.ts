import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateWorkflowDefinitionDto {
  @IsString()
  @IsNotEmpty()
  eventKey: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateWorkflowStepDto {
  @IsString()
  @IsNotEmpty()
  stepKey: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsInt()
  @Min(0)
  orderIndex: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class ExecuteWorkflowEventDto {
  context?: Record<string, any>;
  sourceId?: string;
  sourceType?: string;
}

