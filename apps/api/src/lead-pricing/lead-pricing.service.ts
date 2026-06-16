import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadPricingConfig } from '../entities/lead-pricing-config.entity';

/** Fallback prices if the DB table hasn't been seeded yet */
const FALLBACK = {
  inbound:  { exclusive: '15000', shared: '2500' },
  outbound: { exclusive: '7500',  shared: '1500' },
} as const;

@Injectable()
export class LeadPricingService {
  /** Simple 30-second in-memory cache so we don't hit DB on every lead */
  private cache = new Map<string, { config: LeadPricingConfig; expiresAt: number }>();

  constructor(
    @InjectRepository(LeadPricingConfig)
    private readonly configRepo: Repository<LeadPricingConfig>,
  ) {}

  private async getConfig(leadType: string): Promise<LeadPricingConfig | null> {
    const now = Date.now();
    const hit = this.cache.get(leadType);
    if (hit && hit.expiresAt > now) return hit.config;

    const config = await this.configRepo.findOne({ where: { lead_type: leadType } });
    if (config) {
      this.cache.set(leadType, { config, expiresAt: now + 30_000 });
    }
    return config ?? null;
  }

  /** Invalidate cache (called after admin updates pricing) */
  invalidate(leadType?: string) {
    if (leadType) {
      this.cache.delete(leadType);
    } else {
      this.cache.clear();
    }
  }

  async getExclusivePriceCents(leadType: string): Promise<string> {
    const type = leadType?.toLowerCase() === 'outbound' ? 'outbound' : 'inbound';
    const config = await this.getConfig(type);
    return config?.new_lead_price_cents ?? FALLBACK[type].exclusive;
  }

  async getSharedPriceCents(leadType: string): Promise<string | null> {
    const type = leadType?.toLowerCase() === 'outbound' ? 'outbound' : 'inbound';
    const config = await this.getConfig(type);
    return config?.shared_price_cents ?? FALLBACK[type].shared;
  }

  async getPricesForLead(leadType: string): Promise<{ exclusive: string; shared: string | null }> {
    const [exclusive, shared] = await Promise.all([
      this.getExclusivePriceCents(leadType),
      this.getSharedPriceCents(leadType),
    ]);
    return { exclusive, shared };
  }
}
