import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { LeadPriceHistory } from '../entities/lead-price-history.entity';
import { ExclusivityLevel } from '../../common/enums/exclusivity-level.enum';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';

const SETTINGS_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class LeadPricingService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(LeadPriceHistory)
    private readonly priceHistoryRepo: Repository<LeadPriceHistory>,
    @InjectRepository(DistributionEngineSettings)
    private readonly engineSettingsRepo: Repository<DistributionEngineSettings>,
  ) {}

  computeMarketplaceTier(lead: {
    quality_score: number;
    exclusivity_level: ExclusivityLevel;
    created_at: Date;
  }): 'premium' | 'standard' | 'value' {
    const ageDays =
      (Date.now() - new Date(lead.created_at).getTime()) / (24 * 60 * 60 * 1000);
    const highTier =
      lead.exclusivity_level === ExclusivityLevel.EXCLUSIVE ||
      lead.quality_score >= 85;
    if (highTier) return 'premium';
    if (lead.quality_score < 65 || ageDays > 14) return 'value';
    return 'standard';
  }

  async applyTierToLead(lead: Lead): Promise<Lead> {
    lead.marketplace_tier = this.computeMarketplaceTier(lead);
    if (lead.list_price_anchor_cents == null) {
      lead.list_price_anchor_cents = lead.price_cents;
    }
    return this.leadRepo.save(lead);
  }

  async markdownAgedAvailableLeads(): Promise<number> {
    const settings =
      (await this.engineSettingsRepo.findOne({ where: { id: SETTINGS_ID } })) ??
      (await this.engineSettingsRepo.save(
        this.engineSettingsRepo.create({
          id: SETTINGS_ID,
          queue_paused: false,
          max_auto_distribution_runs: 10,
          cooldown_minutes_between_runs: 15,
          markdown_after_days: 7,
          markdown_percent: 10,
        }),
      ));

    const afterDays = settings.markdown_after_days ?? 7;
    const pct = Math.min(90, Math.max(1, settings.markdown_percent ?? 10));
    const cutoff = new Date(Date.now() - afterDays * 24 * 60 * 60 * 1000);

    const candidates = await this.leadRepo.find({
      where: {
        status: LeadStatus.AVAILABLE,
        created_at: LessThan(cutoff),
      },
    });

    let updated = 0;
    for (const lead of candidates) {
      if (lead.list_price_anchor_cents == null) {
        lead.list_price_anchor_cents = lead.price_cents;
        await this.leadRepo.save(lead);
      }
      if (lead.price_cents !== lead.list_price_anchor_cents) continue;

      const oldPrice = BigInt(lead.price_cents);
      if (oldPrice <= 0n) continue;
      const newPrice = (oldPrice * BigInt(100 - pct)) / 100n;
      if (newPrice >= oldPrice || newPrice < 1n) continue;

      const reason = `Scheduled markdown (${pct}% after ${afterDays}d)`;

      const histories = [
        this.priceHistoryRepo.create({
          lead,
          old_price_cents: lead.price_cents,
          new_price_cents: newPrice.toString(),
          reason,
        }),
      ];

      // Also markdown exclusive_price_cents and shared_price_cents proportionally
      if (lead.exclusive_price_cents != null) {
        const oldExcl = BigInt(lead.exclusive_price_cents);
        const newExcl = (oldExcl * BigInt(100 - pct)) / 100n;
        if (newExcl < oldExcl && newExcl >= 1n) {
          histories.push(
            this.priceHistoryRepo.create({
              lead,
              old_price_cents: lead.exclusive_price_cents,
              new_price_cents: newExcl.toString(),
              reason: `${reason} [exclusive]`,
            }),
          );
          lead.exclusive_price_cents = newExcl.toString();
        }
      }
      if (lead.shared_price_cents != null) {
        const oldShared = BigInt(lead.shared_price_cents);
        const newShared = (oldShared * BigInt(100 - pct)) / 100n;
        if (newShared < oldShared && newShared >= 1n) {
          histories.push(
            this.priceHistoryRepo.create({
              lead,
              old_price_cents: lead.shared_price_cents,
              new_price_cents: newShared.toString(),
              reason: `${reason} [shared]`,
            }),
          );
          lead.shared_price_cents = newShared.toString();
        }
      }

      lead.price_cents = newPrice.toString();
      lead.marketplace_tier = this.computeMarketplaceTier(lead);

      await this.priceHistoryRepo.save(histories);
      await this.leadRepo.save(lead);
      updated++;
    }

    return updated;
  }
}
