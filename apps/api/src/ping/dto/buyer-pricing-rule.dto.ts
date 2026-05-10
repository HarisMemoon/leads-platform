import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpsertBuyerPricingRuleDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  paused?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  markets?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  zips?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  counties?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  property_types?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lead_types?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fixed_price_cents?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_bid_cents?: number | null;

  @IsOptional()
  @IsIn(['exclusive_only', 'non_exclusive_only', 'both'])
  exclusivity_preference?: 'exclusive_only' | 'non_exclusive_only' | 'both';

  @IsOptional()
  @IsIn(['highest_bid', 'priority', 'round_robin'])
  routing_strategy?: 'highest_bid' | 'priority' | 'round_robin';
}
