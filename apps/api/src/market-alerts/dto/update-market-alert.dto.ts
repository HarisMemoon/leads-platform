import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateMarketAlertDto {
  @IsOptional()
  @IsString()
  market?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  delivery_channels?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['instant', 'hourly', 'daily', 'weekly'])
  frequency?: 'instant' | 'hourly' | 'daily' | 'weekly';

  @IsOptional()
  @IsString()
  dnd_start?: string | null;

  @IsOptional()
  @IsString()
  dnd_end?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_per_day?: number | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
