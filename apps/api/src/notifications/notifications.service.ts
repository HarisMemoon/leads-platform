import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationLog } from '../entities/notification-log.entity';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';
import { User } from '../entities/user.entity';
import { MarketAlert } from '../entities/market-alert.entity';
import { Lead } from '../entities/lead.entity';
import { PurchaseType } from '../../common/enums/purchase-type.enum';
import { ProEntitlementService } from '../subscriptions/pro-entitlement.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MarketAlert)
    private readonly marketAlertRepo: Repository<MarketAlert>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ProEntitlementService))
    private readonly proEntitlementService: ProEntitlementService,
  ) {}

  private async createLog(input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    channel: NotificationChannel;
    referenceType?: string | null;
    referenceId?: string | null;
  }) {
    const row = this.logRepo.create({
      user: { id: input.userId } as User,
      type: input.type,
      title: input.title,
      body: input.body,
      channel: input.channel,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
    });
    return this.logRepo.save(row);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const apiKey = (this.config.get<string>('RESEND_API_KEY') ?? '').trim();
    const from = (this.config.get<string>('NOTIFICATION_FROM_EMAIL') ?? '').trim();
    if (!apiKey || !from) {
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Email send failed with HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(
        `Email send failed: ${e instanceof Error ? e.message : 'unknown error'}`,
      );
      return false;
    }
  }

  private async sendSms(to: string, body: string): Promise<boolean> {
    const accountSid = (this.config.get<string>('TWILIO_ACCOUNT_SID') ?? '').trim();
    const authToken = (this.config.get<string>('TWILIO_AUTH_TOKEN') ?? '').trim();
    const from = (this.config.get<string>('TWILIO_FROM_NUMBER') ?? '').trim();
    if (!accountSid || !authToken || !from) {
      return false;
    }

    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const payload = new URLSearchParams({
        To: to,
        From: from,
        Body: body,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: payload.toString(),
        },
      );
      if (!res.ok) {
        this.logger.warn(`SMS send failed with HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`SMS send failed: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }

  async sendUserEvent(input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    referenceType?: string | null;
    referenceId?: string | null;
    channels?: NotificationChannel[];
    emailSubject?: string;
    emailHtml?: string;
    smsBody?: string;
  }) {
    const channels = input.channels ?? [NotificationChannel.IN_APP, NotificationChannel.EMAIL];
    const user = await this.userRepo.findOne({ where: { id: input.userId } });
    if (!user) return;

    if (channels.includes(NotificationChannel.IN_APP)) {
      await this.createLog({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channel: NotificationChannel.IN_APP,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      });
    }

    if (
      channels.includes(NotificationChannel.EMAIL) &&
      user.email &&
      (await this.sendEmail(
        user.email,
        input.emailSubject ?? input.title,
        input.emailHtml ??
          `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${input.title}</h2><p>${input.body}</p></div>`,
      ))
    ) {
      await this.createLog({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channel: NotificationChannel.EMAIL,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      });
    }

    if (
      channels.includes(NotificationChannel.SMS) &&
      user.phone &&
      (await this.sendSms(user.phone, input.smsBody ?? input.body))
    ) {
      await this.createLog({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.smsBody ?? input.body,
        channel: NotificationChannel.SMS,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      });
    }
  }

  async logPurchase(
    userId: string,
    leadTitle: string,
    amountCents: string,
    leadId: string,
    purchaseType: PurchaseType = PurchaseType.MANUAL,
  ) {
    const amount = (Number(amountCents) / 100).toFixed(2);
    const title =
      purchaseType === PurchaseType.AUTO_BUY
        ? 'Lead auto-purchased'
        : 'Lead purchased';
    const body =
      purchaseType === PurchaseType.AUTO_BUY
        ? `A matching lead was auto-purchased for $${amount}: "${leadTitle}".`
        : `You purchased "${leadTitle}" for $${amount}.`;
    await this.sendUserEvent({
      userId,
      type: 'lead_purchase',
      title,
      body,
      referenceType: 'lead',
      referenceId: leadId,
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
      ],
      emailSubject: title,
      smsBody:
        purchaseType === PurchaseType.AUTO_BUY
          ? `Newleey auto-bought "${leadTitle}" for $${amount}.`
          : `Newleey purchase: "${leadTitle}" for $${amount}.`,
    });
  }

  async notifyWalletFunded(
    userId: string,
    amountCents: number,
    balanceAfterCents: string | number,
    referenceId?: string | null,
  ) {
    const amount = (amountCents / 100).toFixed(2);
    const balance = (Number(balanceAfterCents) / 100).toFixed(2);
    await this.sendUserEvent({
      userId,
      type: 'wallet_funded',
      title: 'Wallet funded',
      body: `Your wallet was funded with $${amount}. New balance: $${balance}.`,
      referenceType: 'wallet_transaction',
      referenceId: referenceId ?? null,
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
      ],
      emailSubject: 'Wallet funded',
      smsBody: `Newleey wallet funded: +$${amount}. Balance $${balance}.`,
    });
  }

  async notifyWalletCreditPosted(
    userId: string,
    amountCents: number,
    balanceAfterCents: string | number,
    description: string,
    referenceId?: string | null,
  ) {
    const amount = (amountCents / 100).toFixed(2);
    const balance = (Number(balanceAfterCents) / 100).toFixed(2);
    await this.sendUserEvent({
      userId,
      type: 'wallet_credit',
      title: 'Wallet credit posted',
      body: `${description} added $${amount} to your wallet. New balance: $${balance}.`,
      referenceType: 'wallet_transaction',
      referenceId: referenceId ?? null,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      emailSubject: 'Wallet credit posted',
    });
  }

  async notifyRefundResolved(input: {
    userId: string;
    approved: boolean;
    leadTitle: string;
    resolution?: string | null;
    amountCents?: number | null;
    adminNotes?: string | null;
    refundRequestId: string;
  }) {
    const amount =
      input.amountCents != null ? `$${(input.amountCents / 100).toFixed(2)}` : null;
    const title = input.approved ? 'Refund approved' : 'Refund denied';
    const body = input.approved
      ? `${input.leadTitle} was approved for ${
          input.resolution === 'premium_credit'
            ? 'a premium lead credit return'
            : `a wallet credit${amount ? ` of ${amount}` : ''}`
        }.${input.adminNotes ? ` Notes: ${input.adminNotes}` : ''}`
      : `${input.leadTitle} refund request was denied.${input.adminNotes ? ` Notes: ${input.adminNotes}` : ''}`;

    await this.sendUserEvent({
      userId: input.userId,
      type: 'refund_resolution',
      title,
      body,
      referenceType: 'refund_request',
      referenceId: input.refundRequestId,
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
      ],
      emailSubject: title,
      smsBody: title,
    });
  }

  async notifyMarketAlertsForLead(
    lead: {
      id: string;
      title: string;
      market: string;
      lead_type: string;
      exclusivity_level: string;
      price_cents: string;
      state?: string | null;
      source?: string | null;
    },
    earlyAccessMinutes = 60,
  ) {
    const alerts = await this.marketAlertRepo.find({
      where: { is_active: true },
      relations: { user: true },
    });

    const proAlerts: typeof alerts = [];
    const freeAlerts: typeof alerts = [];

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    for (const alert of alerts) {
      if (alert.frequency !== 'instant') continue;

      const marketMatch =
        ['all', 'any'].includes(alert.market.toLowerCase()) ||
        alert.market.toLowerCase() === lead.market.toLowerCase();
      if (!marketMatch) continue;

      const filters = (alert.filters ?? {}) as { lead_types?: string[]; states?: string[] };

      if (filters.lead_types?.length) {
        const typeMatch = filters.lead_types.some(
          (t) => t.toLowerCase() === lead.lead_type.toLowerCase(),
        );
        if (!typeMatch) continue;
      }

      if (filters.states?.length && lead.state) {
        const stateMatch = filters.states.some(
          (s) => s.toLowerCase() === lead.state!.toLowerCase(),
        );
        if (!stateMatch) continue;
      }

      if (alert.max_per_day != null) {
        const sentToday = await this.logRepo
          .createQueryBuilder('log')
          .where('log.user_id = :userId', { userId: alert.user.id })
          .andWhere('log.type = :type', { type: 'market_alert_match' })
          .andWhere('log.sent_at >= :startOfDay', { startOfDay })
          .getCount();
        if (sentToday >= alert.max_per_day) continue;
      }

      const isPro = await this.proEntitlementService.isPro(alert.user.id);
      if (isPro) {
        proAlerts.push(alert);
      } else {
        freeAlerts.push(alert);
      }
    }

    const sendAlertToUsers = async (alertList: typeof alerts, titlePrefix = '') => {
      for (const alert of alertList) {
        const channels = alert.delivery_channels ?? ['email'];
        const notifChannels: NotificationChannel[] = [NotificationChannel.IN_APP];
        if (channels.includes('email')) notifChannels.push(NotificationChannel.EMAIL);
        if (channels.includes('sms')) notifChannels.push(NotificationChannel.SMS);

        await this.sendUserEvent({
          userId: alert.user.id,
          type: 'market_alert_match',
          title: `${titlePrefix}New lead in your market`,
          body: `${lead.title} is available in ${lead.market} for $${(
            Number(lead.price_cents) / 100
          ).toFixed(2)}.`,
          referenceType: 'lead',
          referenceId: lead.id,
          channels: notifChannels,
          emailSubject: `${titlePrefix}New lead available in ${lead.market}`,
          smsBody: `Newleey: New lead "${lead.title}" in ${lead.market} — $${(Number(lead.price_cents) / 100).toFixed(2)}`,
        });
      }
    };

    await sendAlertToUsers(proAlerts, '[Pro] ');

    if (freeAlerts.length > 0) {
      const delayMs = earlyAccessMinutes * 60 * 1000;
      setTimeout(() => {
        sendAlertToUsers(freeAlerts).catch((e) =>
          this.logger.error('Delayed market alert failed', e),
        );
      }, delayMs);
    }
  }

  async sendAlertDigest(frequency: 'hourly' | 'daily' | 'weekly') {
    const since = new Date();
    if (frequency === 'hourly') since.setHours(since.getHours() - 1);
    else if (frequency === 'daily') since.setDate(since.getDate() - 1);
    else since.setDate(since.getDate() - 7);

    const alerts = await this.marketAlertRepo.find({
      where: { is_active: true, frequency },
      relations: { user: true },
    });

    for (const alert of alerts) {
      const filters = (alert.filters ?? {}) as { lead_types?: string[]; states?: string[] };

      const qb = this.leadRepo
        .createQueryBuilder('l')
        .where('l.created_at >= :since', { since });

      if (filters.lead_types?.length) {
        qb.andWhere('l.lead_type = ANY(:types)', { types: filters.lead_types });
      }
      if (filters.states?.length) {
        qb.andWhere("l.metadata->>'state' = ANY(:states)", { states: filters.states });
      }
      if (!['all', 'any'].includes(alert.market.toLowerCase())) {
        qb.andWhere('l.market = :market', { market: alert.market });
      }

      const leads = await qb.orderBy('l.created_at', 'DESC').getMany();
      if (!leads.length) continue;

      const label =
        frequency === 'hourly' ? 'past hour' : frequency === 'daily' ? 'today' : 'this week';
      const title = `${leads.length} new lead${leads.length > 1 ? 's' : ''} available — ${label}`;
      const items = leads
        .slice(0, 10)
        .map(
          (l) =>
            `<li style="margin-bottom:8px"><strong>${l.title}</strong> — ${l.market} — $${(Number(l.price_cents) / 100).toFixed(2)}</li>`,
        )
        .join('');
      const emailHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin-bottom:16px">${title}</h2>
        <ul style="padding-left:20px">${items}</ul>
        ${leads.length > 10 ? `<p>...and ${leads.length - 10} more available on the marketplace.</p>` : ''}
      </div>`;
      const smsBody = `Newleey: ${leads.length} new lead${leads.length > 1 ? 's' : ''} available (${label}). Check your marketplace.`;

      const channels = alert.delivery_channels ?? ['email'];
      const notifChannels: NotificationChannel[] = [NotificationChannel.IN_APP];
      if (channels.includes('email')) notifChannels.push(NotificationChannel.EMAIL);
      if (channels.includes('sms')) notifChannels.push(NotificationChannel.SMS);

      await this.sendUserEvent({
        userId: alert.user.id,
        type: 'market_alert_digest',
        title,
        body: `${leads.length} new lead${leads.length > 1 ? 's' : ''} matching your alert are available.`,
        channels: notifChannels,
        emailSubject: title,
        emailHtml,
        smsBody,
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async digestHourly() {
    await this.sendAlertDigest('hourly').catch((e) =>
      this.logger.error('Hourly digest failed', e),
    );
  }

  @Cron('0 8 * * *')
  async digestDaily() {
    await this.sendAlertDigest('daily').catch((e) =>
      this.logger.error('Daily digest failed', e),
    );
  }

  @Cron('0 8 * * 1')
  async digestWeekly() {
    await this.sendAlertDigest('weekly').catch((e) =>
      this.logger.error('Weekly digest failed', e),
    );
  }

  async listForUser(userId: string, limit = 50) {
    return this.logRepo.find({
      where: { user: { id: userId } },
      order: { sent_at: 'DESC' },
      take: limit,
    });
  }
}
