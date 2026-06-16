import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class VendorPingDto {
  /** Vendor's own unique ping ID — if omitted, the platform generates one (Juiced-compatible) */
  @IsOptional()
  @IsString()
  vendor_ping_id?: string;

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

  /** Juiced camelCase variant — maps to property_type internally */
  @IsOptional()
  @IsString()
  propertyType?: string;

  /** Whether the property is listed on MLS — "true" / "false" */
  @IsOptional()
  @IsString()
  listed?: string;

  /** Seller's timeline — e.g. "ASAP", "Within 3 Months" */
  @IsOptional()
  @IsString()
  howsoontosell?: string;

  /** Juiced alias for howsoontosell */
  @IsOptional()
  @IsString()
  timeline?: string;

  /** Reason for selling — e.g. "Inherited", "Foreclosure" */
  @IsOptional()
  @IsString()
  reasonforselling?: string;

  /** Juiced alias for reasonforselling */
  @IsOptional()
  @IsString()
  reason?: string;

  /** Property condition */
  @IsOptional()
  @IsString()
  property_condition?: string;

  /** Juiced alias for property_condition */
  @IsOptional()
  @IsString()
  condition?: string;

  // ── Lead classification ───────────────────────────────────────────────────────
  /** Lead type — e.g. "motivated_seller", "Outbound", "Inbound" */
  @IsOptional()
  @IsString()
  lead_type?: string;

  /** Juiced camelCase alias for lead_type */
  @IsOptional()
  @IsString()
  leadType?: string;

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

  /** Juiced alias for TrustedForm (ActiveProspect cert URL) */
  @IsOptional()
  @IsString()
  xxTrustedFormCertUrl?: string;

  /** Timestamp the vendor's form was submitted (ISO string) */
  @IsOptional()
  @IsString()
  submitted_at?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
