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

  // ── Location ─────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  /** Accepts "Zip" (vendor PascalCase) as well as "zip" */
  @IsOptional()
  @IsString()
  Zip?: string;

  @IsOptional()
  @IsString()
  county?: string;

  @IsOptional()
  @IsString()
  market?: string;

  // ── Property details ─────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  property_type?: string;

  /** Vendor PascalCase variant — maps to property_type internally */
  @IsOptional()
  @IsString()
  Propertytype?: string;

  /** Whether the property is listed on MLS — "true" / "false" */
  @IsOptional()
  @IsString()
  listed?: string;

  /** Seller's timeline — e.g. "ASAP", "Within 3 Months" */
  @IsOptional()
  @IsString()
  howsoontosell?: string;

  /** Reason for selling — e.g. "Inherited", "Foreclosure" */
  @IsOptional()
  @IsString()
  reasonforselling?: string;

  /** Property condition */
  @IsOptional()
  @IsString()
  property_condition?: string;

  // ── Lead classification ───────────────────────────────────────────────────────
  /** Lead type — e.g. "motivated_seller", "Outbound", "Inbound" */
  @IsOptional()
  @IsString()
  lead_type?: string;

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

  // ── Seller identity (pre-ping enrichment) ────────────────────────────────────
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address_1?: string;

  @IsOptional()
  @IsString()
  address_2?: string;

  @IsOptional()
  @IsString()
  fulladdress?: string;

  // ── Attribution & compliance ─────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsString()
  IP_Address?: string;

  @IsOptional()
  @IsString()
  TrustedForm?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
