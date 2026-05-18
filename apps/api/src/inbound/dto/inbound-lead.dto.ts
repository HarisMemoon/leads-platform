import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class InboundLeadDto {
  @IsString()
  @MaxLength(120)
  market!: string;

  @IsString()
  @MaxLength(80)
  lead_type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price_cents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  exclusive_price_cents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  shared_price_cents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  quality_score?: number;

  /** Inbound lead source label, e.g. 'website', 'facebook', 'google' */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source_label?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
