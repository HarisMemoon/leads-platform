import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
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
  @IsEmail()
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
