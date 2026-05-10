import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ExclusivityLevel } from '../../../common/enums/exclusivity-level.enum';

export class ListMarketplaceLeadsDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  /**
   * Filter the marketplace feed by exclusivity type.
   * 'exclusive_only' — leads that can be bought exclusively
   * 'non_exclusive_only' — leads that can be shared
   * 'both' (default) — all available leads
   */
  @IsOptional()
  @IsIn(['exclusive_only', 'non_exclusive_only', 'both'])
  exclusivity_filter?: 'exclusive_only' | 'non_exclusive_only' | 'both';

  @IsOptional()
  @IsString()
  market?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  property_type?: string;

  @IsOptional()
  @IsString()
  timeline?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsEnum(ExclusivityLevel)
  exclusivity?: ExclusivityLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxAgeDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 25;
}

