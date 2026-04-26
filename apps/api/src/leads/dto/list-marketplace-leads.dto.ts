import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ExclusivityLevel } from '../../../common/enums/exclusivity-level.enum';

export class ListMarketplaceLeadsDto {
  /** premium = non-exclusive marketplace tier; exclusive = exclusivity exclusive only */
  @IsOptional()
  @IsIn(['premium', 'exclusive'])
  lead_mode?: 'premium' | 'exclusive';

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsIn(['premium', 'standard', 'value'])
  marketplaceTier?: 'premium' | 'standard' | 'value';

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

