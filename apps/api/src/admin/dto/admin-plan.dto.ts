import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlanFeatureBulletPatchDto {
  @IsString()
  @MaxLength(280)
  text!: string;

  @IsBoolean()
  visible!: boolean;
}

export class PatchPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  tagline?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthly_price_cents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  display_price?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  billing_period_label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthly_lead_limit?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  lead_limit_summary?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority_rank?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  priority_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  distribution_summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  included_lead_credits_summary?: string | null;

  @IsOptional()
  @IsObject()
  filter_scope?: Record<string, boolean>;

  @IsOptional()
  @IsArray()
  card_highlights?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureBulletPatchDto)
  feature_bullets?: PlanFeatureBulletPatchDto[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
