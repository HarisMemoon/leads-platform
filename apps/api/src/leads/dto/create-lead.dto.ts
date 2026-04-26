import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { LeadStatus } from '../../../common/enums/lead-status.enum';
import { ExclusivityLevel } from '../../../common/enums/exclusivity-level.enum';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsString()
  @IsNotEmpty()
  market!: string;

  @IsString()
  @IsNotEmpty()
  lead_type!: string;

  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @IsEnum(ExclusivityLevel)
  exclusivity_level!: ExclusivityLevel;

  @IsInt()
  @Min(0)
  quality_score!: number;

  @IsInt()
  @Min(0)
  price_cents!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  external_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  canonical_lead_source?: string;

  @IsOptional()
  @IsObject()
  utm?: Record<string, string>;
}
