import { Type } from 'class-transformer';
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

  /** Price when a single buyer takes this lead exclusively. Defaults to price_cents. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  exclusive_price_cents?: number;

  /** Per-buyer price when multiple buyers share this lead. Defaults to price_cents. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  shared_price_cents?: number;

  /** Maximum shared buyers allowed. Defaults to 3. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_non_exclusive_buyers?: number;

  /** Override early-access window in minutes. Defaults to engine setting (60). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  early_access_minutes?: number;

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
