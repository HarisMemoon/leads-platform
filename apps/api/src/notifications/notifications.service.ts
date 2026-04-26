import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../entities/notification-log.entity';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';
import { User } from '../entities/user.entity';
import { MarketAlert } from '../entities/market-alert.entity';
import { PurchaseType } from '../../common/enums/purchase-type.enum';

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
    private readonly config: ConfigService,
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

  async notifyMarketAlertsForLead(lead: {
    id: string;
    title: string;
    market: string;
    lead_type: string;
    exclusivity_level: string;
    price_cents: string;
  }) {
    const alerts = await this.marketAlertRepo.find({
      where: { is_active: true },
      relations: { user: true },
    });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    for (const alert of alerts) {
      if (alert.frequency !== 'instant') continue;
      const marketMatch =
        alert.market.toLowerCase() === 'all' ||
        alert.market.toLowerCase() === lead.market.toLowerCase();
      if (!marketMatch) continue;

      const filters = alert.filters ?? {};
      const requestedType = String(filters.lead_type ?? filters.type ?? '').trim();
      if (requestedType && requestedType.toLowerCase() !== lead.lead_type.toLowerCase()) {
        continue;
      }
      const requestedExclusivity = String(filters.exclusivity ?? '').trim();
      if (
        requestedExclusivity &&
        requestedExclusivity.toLowerCase() !== lead.exclusivity_level.toLowerCase()
      ) {
        continue;
      }
      const maxPrice = Number(filters.max_price_cents ?? filters.maxPriceCents ?? NaN);
      if (Number.isFinite(maxPrice) && Number(lead.price_cents) > maxPrice) {
        continue;
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

      await this.sendUserEvent({
        userId: alert.user.id,
        type: 'market_alert_match',
        title: 'New lead in your market',
        body: `${lead.title} is available in ${lead.market} for $${(
          Number(lead.price_cents) / 100
        ).toFixed(2)}.`,
        referenceType: 'lead',
        referenceId: lead.id,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        emailSubject: `New lead available in ${lead.market}`,
      });
    }
  }

  async listForUser(userId: string, limit = 50) {
    return this.logRepo.find({
      where: { user: { id: userId } },
      order: { sent_at: 'DESC' },
      take: limit,
    });
  }
}
