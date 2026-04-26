import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class GradingOverrideDto {
  @IsUUID()
  lead_id!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  override_score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
