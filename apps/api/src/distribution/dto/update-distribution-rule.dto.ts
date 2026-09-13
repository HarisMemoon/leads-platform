import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateDistributionRuleDto {
  @IsOptional()
  @IsBoolean()
  participation_enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_per_day?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_leads_per_day?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_leads_per_week?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_leads_per_month?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_spend_per_day_cents?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_spend_per_week_cents?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_spend_per_month_cents?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_wallet_balance_cents?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lead_type_filters?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cooldown_minutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rotation_position?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  market_filters?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  property_type_filters?: string[];

  /** Set true when a non-Pro buyer accepts the full-price autobuy disclaimer. */
  @IsOptional()
  @IsBoolean()
  autobuy_disclaimer_accepted?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  /** 'exclusive_only' | 'non_exclusive_only' | 'both' */
  @IsOptional()
  @IsIn(['exclusive_only', 'non_exclusive_only', 'both'])
  exclusivity_preference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_lead_price_cents?: number | null;
}
