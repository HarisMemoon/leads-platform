import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

@Injectable()
export class MonthlyCapResetWorker {
  private readonly logger = new Logger(MonthlyCapResetWorker.name);

  constructor(
    @InjectRepository(DistributionRule)
    private readonly ruleRepo: Repository<DistributionRule>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  /**
   * Runs every hour. For each customer who has a launched_at date, checks
   * whether 30 days have elapsed since launch (or last reset) and resets
   * leads_used_this_period on their subscription if so.
   *
   * This decouples the monthly lead cap from the Stripe billing cycle so
   * caps always reset 30 days from the customer's launch date.
   */
  @Cron('0 * * * *')
  async resetExpiredCaps() {
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Find rules that have launched and whose 30-day window has elapsed
    const rules = await this.ruleRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .where('r.launched_at IS NOT NULL')
      .getMany();

    let resetCount = 0;
    for (const rule of rules) {
      if (!rule.launched_at || !rule.user?.id) continue;

      const launchMs = new Date(rule.launched_at).getTime();
      const elapsed = now.getTime() - launchMs;
      const fullCycles = Math.floor(elapsed / thirtyDaysMs);
      if (fullCycles === 0) continue;

      // Calculate the expected reset date for the current cycle
      const nextResetAt = new Date(launchMs + fullCycles * thirtyDaysMs);
      // If next reset is in the past we need to reset
      if (nextResetAt > now) continue;

      // Find the active subscription and reset its period counter
      const sub = await this.subscriptionRepo.findOne({
        where: {
          user: { id: rule.user.id },
          status: SubscriptionStatus.ACTIVE,
        },
      });
      if (!sub || sub.monthly_lead_limit == null) continue;

      // Only reset if the leads_used counter is > 0 (avoid unnecessary writes)
      if (sub.leads_used_this_period > 0) {
        sub.leads_used_this_period = 0;
        await this.subscriptionRepo.save(sub);
        resetCount++;
        this.logger.log(`Reset monthly cap for user ${rule.user.id} (cycle ${fullCycles})`);
      }

      // Advance launched_at by one cycle so we don't reset again next run
      rule.launched_at = new Date(launchMs + fullCycles * thirtyDaysMs);
      await this.ruleRepo.save(rule);
    }

    if (resetCount > 0) {
      this.logger.log(`Monthly cap reset: ${resetCount} customer(s) reset`);
    }
  }
}
