import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateVendorIntegrationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  api_key!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_sources?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  ping_timeout_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  ping_ttl_seconds?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class PatchVendorIntegrationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  api_key?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_sources?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  ping_timeout_ms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  ping_ttl_seconds?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
