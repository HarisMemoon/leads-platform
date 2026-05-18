import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngestionRowDto {
  @IsString()
  @MaxLength(120)
  market!: string;

  @IsString()
  @MaxLength(60)
  lead_type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contact_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contact_phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  quality_score?: number;

  @IsInt()
  @Min(0)
  price_cents!: number;

  @IsOptional()
  @IsIn(['exclusive', 'non_exclusive'])
  exclusivity_level?: 'exclusive' | 'non_exclusive';

  // Seller contact
  @IsOptional()
  @IsString()
  @MaxLength(120)
  seller_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  last_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  // Location metadata
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  zip?: string;

  // Property metadata
  @IsOptional()
  @IsString()
  @MaxLength(60)
  property_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timeline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateIngestionBatchDto {
  @IsString()
  @MaxLength(200)
  filename!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vendor?: string;

  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => IngestionRowDto)
  rows!: IngestionRowDto[];
}
