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
  /** Internal ping UUID returned by /ping — required to match this post to a bid */
  @IsString()
  @IsNotEmpty()
  ping_id!: string;

  /** Vendor's own unique lead ID — used for idempotency */
  @IsString()
  @IsNotEmpty()
  vendor_lead_id!: string;

  // ── Seller identity ──────────────────────────────────────────────────────────
  /** Full seller name — use this OR first_name + last_name */
  @IsOptional()
  @IsString()
  seller_name?: string;

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
  @IsEmail()
  email?: string;

  // ── Property address ─────────────────────────────────────────────────────────
  /** Full address string — use this OR address_1 / address_2 / fulladdress */
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  address_1?: string;

  @IsOptional()
  @IsString()
  address_2?: string;

  /** Combined full address from vendor (e.g. "123 Main St, Dallas, TX 75201") */
  @IsOptional()
  @IsString()
  fulladdress?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  /** Accepts "zip" or "Zip" */
  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  Zip?: string;

  // ── Property details ─────────────────────────────────────────────────────────
  /** Property type — accepts "Propertytype" (vendor-style) or "property_type" */
  @IsOptional()
  @IsString()
  property_type?: string;

  @IsOptional()
  @IsString()
  Propertytype?: string;

  /** Whether the property is listed on MLS — "true" / "false" */
  @IsOptional()
  @IsString()
  listed?: string;

  /** Seller's timeline / how soon to sell — e.g. "ASAP", "Within 3 Months" */
  @IsOptional()
  @IsString()
  howsoontosell?: string;

  /** Reason for selling — e.g. "Inherited", "Foreclosure", "Divorce" */
  @IsOptional()
  @IsString()
  reasonforselling?: string;

  /** Property condition — e.g. "Good", "Fair", "Poor" */
  @IsOptional()
  @IsString()
  property_condition?: string;

  // ── Attribution & compliance ─────────────────────────────────────────────────
  /** Vendor / brand name sending this lead */
  @IsOptional()
  @IsString()
  vendor?: string;

  /** UTM source / referring URL */
  @IsOptional()
  @IsString()
  referrer?: string;

  /** Visitor IP address */
  @IsOptional()
  @IsString()
  IP_Address?: string;

  /** ActiveProspect TrustedForm certificate URL */
  @IsOptional()
  @IsString()
  TrustedForm?: string;

  // ── Legacy / misc ────────────────────────────────────────────────────────────
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
