import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Lead } from '../entities/lead.entity';

export interface DuplicateLeadInput {
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  zip?: unknown;
}

/**
 * LeadDedupService — the ONE duplicate check shared by every lead entry path.
 *
 * Match rule (identical to the original ping-path implementation):
 * a lead is a duplicate when phone OR email OR (address + zip) matches an
 * existing lead's metadata (JSONB), compared case-insensitively; the oldest
 * matching lead wins.
 *
 * Policy by caller:
 * - Vendor paths (ping / post / direct lead / inbound webhook): HARD reject —
 *   the vendor gets an immediate `duplicate_lead` response so it can fix and
 *   resend instead of silently double-listing the seller.
 * - Admin CSV bulk import: the row FAILS with a `duplicate_lead` reason and is
 *   counted in the batch's failed rows / failure samples.
 * - Admin MANUAL entry (LeadsService.createLead) intentionally does NOT use
 *   this hard reject — it keeps its soft-flag via `detectCanonicalDuplicate`
 *   (`duplicate_of_lead_id` + Duplicates review tab), because a human admin
 *   may legitimately re-enter a lead and should review, not be blocked.
 */
@Injectable()
export class LeadDedupService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
  ) {}

  async findDuplicate(input: DuplicateLeadInput): Promise<Lead | null> {
    const clauses: string[] = [];
    const params: Record<string, string> = {};
    const phone = this.clean(input.phone);
    const email = this.clean(input.email)?.toLowerCase() ?? null;
    const address = this.clean(input.address)?.toLowerCase() ?? null;
    const zip = this.clean(input.zip);

    if (phone) {
      clauses.push(
        `LOWER(TRIM(COALESCE(lead.metadata->>'phone',''))) = :phone`,
      );
      params.phone = phone.toLowerCase();
    }
    if (email) {
      clauses.push(
        `LOWER(TRIM(COALESCE(lead.metadata->>'email',''))) = :email`,
      );
      params.email = email;
    }
    if (address) {
      clauses.push(
        `(LOWER(TRIM(COALESCE(lead.metadata->>'address',''))) = :address${
          zip ? " AND TRIM(COALESCE(lead.metadata->>'zip','')) = :zip" : ''
        })`,
      );
      params.address = address;
      if (zip) params.zip = zip;
    }
    if (clauses.length === 0) return null;

    return this.leadRepo
      .createQueryBuilder('lead')
      .where(`(${clauses.join(' OR ')})`, params)
      .orderBy('lead.created_at', 'ASC')
      .getOne();
  }

  private clean(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }
}
