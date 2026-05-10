import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class VendorPingDto {
  @IsString()
  @IsNotEmpty()
  vendor_ping_id!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  county?: string;

  @IsOptional()
  @IsString()
  market?: string;

  @IsOptional()
  @IsString()
  property_type?: string;

  @IsString()
  @IsNotEmpty()
  lead_type!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsIn(['exclusive', 'non_exclusive'])
  exclusivity_choice?: 'exclusive' | 'non_exclusive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  asking_price_cents?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  motivation_tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
