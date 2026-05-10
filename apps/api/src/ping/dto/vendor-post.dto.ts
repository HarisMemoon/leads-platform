import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class VendorPostDto {
  @IsString()
  @IsNotEmpty()
  ping_id!: string;

  @IsString()
  @IsNotEmpty()
  vendor_lead_id!: string;

  @IsString()
  @IsNotEmpty()
  seller_name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quality_score?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
