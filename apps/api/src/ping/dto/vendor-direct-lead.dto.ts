import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

import { VendorPingDto } from './vendor-ping.dto';

/**
 * Single-call lead submission — superset of the ping and post field sets.
 * Vendors who don't want to do a ping → post round trip can send everything
 * in one request and the lead is created directly in the marketplace.
 */
export class VendorDirectLeadDto extends VendorPingDto {
  /** Vendor's own unique lead ID — used for idempotency. If omitted, one is generated. */
  @IsOptional()
  @IsString()
  vendor_lead_id?: string;

  /** Full seller name — use this OR first_name + last_name */
  @IsOptional()
  @IsString()
  seller_name?: string;

  /** Full address string — use this OR address_1 / address_2 / fulladdress */
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quality_score?: number;
}
