import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionReminderWorker {
  private readonly logger = new Logger(SubscriptionReminderWorker.name);
  private readonly appBaseUrl: string;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    this.appBaseUrl = (this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:3000').trim();
  }

  /** Runs once per hour — sends day-2 and day-3 payment failure reminders. */
  @Cron('0 * * * *')
  async sendPaymentFailureReminders() {
    const now = new Date();

    // Day-2 window: updated_at between 24h and 48h ago
    const day2From = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const day2To   = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Day-3 window: updated_at between 48h and 72h ago
    const day3From = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const day3To   = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    await this.sendReminders(day2From, day2To, 2);
    await this.sendReminders(day3From, day3To, 3);
  }

  private async sendReminders(from: Date, to: Date, day: 2 | 3) {
    const subs = await this.subscriptionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.status = :status', { status: SubscriptionStatus.PAST_DUE })
      .andWhere('s.updated_at >= :from', { from })
      .andWhere('s.updated_at < :to', { to })
      .getMany();

    for (const sub of subs) {
      if (!sub.user?.id) continue;
      try {
        const isDay3 = day === 3;
        await this.notificationsService.sendUserEvent({
          userId: sub.user.id,
          type: `subscription_payment_reminder_day${day}`,
          title: isDay3 ? 'Final reminder: Update your Newleey payment' : 'Reminder: Your Newleey payment is still due',
          body: isDay3
            ? 'This is your final reminder. If payment is not updated, your subscription will be canceled and access to discounted shared leads will end.'
            : 'Your Newleey subscription payment still has not gone through. Update your payment method to restore auto lead delivery.',
          emailSubject: isDay3 ? 'Final reminder: Newleey subscription payment required' : 'Reminder: Newleey payment still pending',
          emailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.6">
            <h2 style="color:#f59e0b">${isDay3 ? 'Final Reminder' : 'Payment Reminder'} — Day ${day}</h2>
            <p>${isDay3
              ? 'This is your <strong>final reminder</strong>. Your subscription will be canceled and you will lose access to discounted $25 shared leads unless payment is resolved.'
              : 'Your $49/month subscription payment is still pending. Auto lead delivery remains paused.'
            }</p>
            <a href="${this.appBaseUrl}/subscriptions" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Update Payment Method →</a>
            <p style="margin-top:16px;font-size:12px;color:#999">Your wallet balance and lead settings are preserved and will resume once payment is restored.</p>
          </div>`,
        });
      } catch (e) {
        this.logger.warn(`Failed to send day-${day} reminder for user ${sub.user.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}
