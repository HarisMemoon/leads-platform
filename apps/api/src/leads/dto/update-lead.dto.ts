import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LeadStatus } from '../../../common/enums/lead-status.enum';
import { ExclusivityLevel } from '../../../common/enums/exclusivity-level.enum';

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  market?: string;

  @IsOptional()
  @IsString()
  lead_type?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(ExclusivityLevel)
  exclusivity_level?: ExclusivityLevel;

  @IsOptional()
  @IsInt()
  @Min(0)
  quality_score?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  price_cents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  exclusive_price_cents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  shared_price_cents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_non_exclusive_buyers?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  external_id?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
