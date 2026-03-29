import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../entities/notification-log.entity';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
  ) {}

  async logPurchase(
    userId: string,
    leadTitle: string,
    amountCents: string,
    leadId: string,
  ) {
    const amount = (Number(amountCents) / 100).toFixed(2);
    const row = this.logRepo.create({
      user: { id: userId } as any,
      type: 'lead_purchase',
      title: 'Lead purchased',
      body: `You purchased "${leadTitle}" for $${amount}.`,
      channel: NotificationChannel.IN_APP,
      reference_type: 'lead',
      reference_id: leadId,
    });
    return this.logRepo.save(row);
  }

  async listForUser(userId: string, limit = 50) {
    return this.logRepo.find({
      where: { user: { id: userId } },
      order: { sent_at: 'DESC' },
      take: limit,
    });
  }
}
