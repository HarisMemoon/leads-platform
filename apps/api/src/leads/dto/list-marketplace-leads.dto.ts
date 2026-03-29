import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ExclusivityLevel } from '../../../common/enums/exclusivity-level.enum';

export class ListMarketplaceLeadsDto {
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

