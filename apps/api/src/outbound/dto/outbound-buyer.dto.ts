import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class CreateOutboundBuyerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUrl({ require_tld: false })
  ping_url!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  post_url?: string | null;

  @IsOptional()
  @IsString()
  auth_header_name?: string | null;

  @IsOptional()
  @IsString()
  auth_header_value?: string | null;

  /** { "our_field": "their_field" } */
  @IsOptional()
  @IsObject()
  field_map?: Record<string, string>;

  /** Static key-value pairs merged into every request to this buyer.
   *  E.g. { "vendor": "Newleey" }
   */
  @IsOptional()
  @IsObject()
  static_fields?: Record<string, unknown>;

  /** Minimum bid in cents (e.g. 2500 = $25.00) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  price_floor_cents?: number;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30000)
  timeout_ms?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class PatchOutboundBuyerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  ping_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  post_url?: string | null;

  @IsOptional()
  @IsString()
  auth_header_name?: string | null;

  @IsOptional()
  @IsString()
  auth_header_value?: string | null;

  @IsOptional()
  @IsObject()
  field_map?: Record<string, string>;

  @IsOptional()
  @IsObject()
  static_fields?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_floor_cents?: number;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30000)
  timeout_ms?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
