import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SubscriptionExpiryWorker {
  private readonly logger = new Logger(SubscriptionExpiryWorker.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(DistributionRule)
    private readonly distributionRuleRepo: Repository<DistributionRule>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Runs every hour.
   *
   * When a customer cancels, we honour their access until current_period_end.
   * Once that date passes this worker:
   *  1. Disables their distribution rule (stops auto-delivery).
   *  2. Sends them a "your subscription has ended" email.
   *
   * We check paid-period expiry for CANCELLED subscriptions only.
   * PAST_DUE accounts are handled separately by the Stripe webhook worker.
   */
  @Cron('0 * * * *')
  async enforceExpiredCancellations() {
    const now = new Date();

    // Find cancelled subscriptions whose paid period has now expired
    const expired = await this.subscriptionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.status = :status', { status: SubscriptionStatus.CANCELLED })
      .andWhere('s.current_period_end IS NOT NULL')
      .andWhere('s.current_period_end < :now', { now })
      .getMany();

    for (const sub of expired) {
      if (!sub.user?.id) continue;
      try {
        // Pause auto-delivery — rule stays saved but is_active = false
        await this.distributionRuleRepo.update(
          { user: { id: sub.user.id }, is_active: true },
          { is_active: false, participation_enabled: false },
        );

        // Notify the customer their access has ended
        void this.notificationsService.sendUserEvent({
          userId: sub.user.id,
          type: 'subscription_expired',
          title: 'Your Newleey subscription has ended',
          body: 'Your subscription period has ended. Auto lead delivery has been turned off. Your wallet balance is still available for exclusive lead purchases. Reactivate your subscription to access discounted shared leads.',
          emailSubject: 'Your Newleey subscription has ended',
          emailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.6">
            <h2>Subscription Ended</h2>
            <p>Your Newleey subscription period has ended and auto lead delivery has been paused.</p>
            <p><strong>Your wallet balance is preserved</strong> and can still be used to purchase exclusive leads at any time.</p>
            <p>To access discounted $25 shared inbound leads and re-enable auto delivery, reactivate your subscription.</p>
            <a href="${process.env.APP_BASE_URL ?? ''}/subscriptions" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Reactivate Subscription →</a>
          </div>`,
        }).catch((e) => this.logger.warn(`Expiry notification failed for user ${sub.user.id}: ${e instanceof Error ? e.message : e}`));

      } catch (e) {
        this.logger.error(`Failed to process expiry for subscription ${sub.id}: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (expired.length > 0) {
      this.logger.log(`Processed ${expired.length} expired cancelled subscription(s)`);
    }
  }
}
