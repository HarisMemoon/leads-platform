import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LeadRefundRequest } from '../entities/lead-refund-request.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { Lead } from '../entities/lead.entity';
import { RefundRequestStatus } from '../../common/enums/refund-request-status.enum';
import { PurchaseType } from '../../common/enums/purchase-type.enum';
import { WalletService } from '../wallet/wallet.service';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { GhlOutboundService } from '../integrations/ghl-outbound.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { DistributionService } from '../distribution/distribution.service';
import { LeadStatus } from '../../common/enums/lead-status.enum';

@Injectable()
export class RefundRequestsService {
  constructor(
    @InjectRepository(LeadRefundRequest)
    private readonly refundRepo: Repository<LeadRefundRequest>,
    @InjectRepository(LeadAssignment)
    private readonly assignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly walletService: WalletService,
    private readonly ghlOutbound: GhlOutboundService,
    private readonly notificationsService: NotificationsService,
    private readonly integrationsService: IntegrationsService,
    private readonly distributionService: DistributionService,
  ) {}

  async createForBuyer(buyerId: string, assignmentId: string, reason: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: { buyer: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.buyer.id !== buyerId) {
      throw new ForbiddenException('Not your purchase');
    }
    const existing = await this.refundRepo
      .createQueryBuilder('r')
      .innerJoin('r.lead_assignment', 'a')
      .where('a.id = :aid', { aid: assignmentId })
      .andWhere('r.status = :st', { st: RefundRequestStatus.PENDING })
      .getOne();
    if (existing) {
      throw new BadRequestException('A pending refund already exists for this lead');
    }
    const row = this.refundRepo.create({
      buyer: { id: buyerId } as any,
      lead_assignment: { id: assignmentId } as any,
      reason,
      status: RefundRequestStatus.PENDING,
    });
    return this.refundRepo.save(row);
  }

  listMine(buyerId: string) {
    return this.refundRepo.find({
      where: { buyer: { id: buyerId } },
      relations: { lead_assignment: { lead: true } },
      order: { created_at: 'DESC' },
    });
  }

  listAdmin() {
    return this.refundRepo.find({
      where: { status: RefundRequestStatus.PENDING },
      relations: { buyer: true, lead_assignment: { lead: true } },
      order: { created_at: 'ASC' },
    });
  }

  listAllAdmin() {
    return this.refundRepo.find({
      relations: { buyer: true, lead_assignment: { lead: true } },
      order: { created_at: 'DESC' },
      take: 200,
    });
  }

  async resolveAdmin(
    id: string,
    status: 'approved' | 'rejected',
    adminNotes: string | undefined,
    resolution: 'wallet_credit' | 'premium_credit' | undefined,
  ) {
    const row = await this.refundRepo.findOne({
      where: { id },
      relations: {
        lead_assignment: { buyer: true, lead: true },
        buyer: true,
      },
    });
    if (!row) throw new NotFoundException('Refund request not found');
    if (row.status !== RefundRequestStatus.PENDING) {
      throw new BadRequestException('Refund is no longer pending');
    }
    row.admin_notes = adminNotes ?? null;
    if (status === 'rejected') {
      row.status = RefundRequestStatus.REJECTED;
      row.resolution = null;
      const saved = await this.refundRepo.save(row);
      void this.ghlOutbound.emit('refund_request_rejected', {
        refund_request_id: saved.id,
        buyer_id: row.buyer.id,
      });
      await Promise.allSettled([
        this.notificationsService.notifyRefundResolved({
          userId: row.buyer.id,
          approved: false,
          leadTitle: row.lead_assignment.lead.title,
          adminNotes: row.admin_notes,
          refundRequestId: saved.id,
        }),
        this.integrationsService.emitCustomWebhookEvent(row.buyer.id, 'refund_rejected', {
          refund_request_id: saved.id,
          assignment_id: row.lead_assignment.id,
          lead_id: row.lead_assignment.lead.id,
          lead_title: row.lead_assignment.lead.title,
          notes: row.admin_notes,
        }),
      ]);
      return saved;
    }
    if (!resolution) {
      throw new BadRequestException('resolution is required when approving');
    }
    const assignment = row.lead_assignment;
    const buyerId = assignment.buyer.id;
    const amount = Number(assignment.amount_charged_cents);
    if (resolution === 'wallet_credit') {
      if (
        assignment.purchase_type !== PurchaseType.MANUAL &&
        assignment.purchase_type !== PurchaseType.AUTO_BUY
      ) {
        throw new BadRequestException(
          'Wallet credit refunds apply to wallet (exclusive) purchases',
        );
      }
      await this.walletService.topup(
        buyerId,
        amount,
        'Lead purchase refund',
        'refund_approved',
        row.id,
      );
    } else {
      if (assignment.purchase_type !== PurchaseType.SUBSCRIPTION_DISTRIBUTION) {
        throw new BadRequestException(
          'Premium credit refunds apply to subscription-distributed leads',
        );
      }
      const sub = await this.subscriptionRepo.findOne({
        where: {
          user: { id: buyerId },
          status: In([
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.PAUSED,
          ]),
        },
        order: { updated_at: 'DESC' },
      });
      if (!sub) throw new BadRequestException('No active subscription to credit');
      sub.leads_used_this_period = Math.max(0, sub.leads_used_this_period - 1);
      await this.subscriptionRepo.save(sub);
    }
    row.status = RefundRequestStatus.APPROVED;
    row.resolution = resolution;
    const saved = await this.refundRepo.save(row);
    const duplicateRequested =
      row.reason.toLowerCase().includes('duplicate') ||
      Boolean(assignment.lead.duplicate_of_lead);
    if (duplicateRequested) {
      assignment.lead.status = LeadStatus.AVAILABLE;
      assignment.lead.reserved_until = null;
      assignment.lead.reserved_by_user = null;
      assignment.lead.distribution_run_count = 0;
      assignment.lead.last_distribution_at = null;
      await this.leadRepo.save(assignment.lead);
      await this.distributionService.enqueueLeadDistribution(assignment.lead.id);
    }
    void this.ghlOutbound.emit('refund_request_approved', {
      refund_request_id: saved.id,
      buyer_id: buyerId,
      resolution,
      assignment_id: assignment.id,
    });
    await Promise.allSettled([
      this.notificationsService.notifyRefundResolved({
        userId: buyerId,
        approved: true,
        leadTitle: assignment.lead.title,
        resolution,
        amountCents: amount,
        adminNotes: row.admin_notes,
        refundRequestId: saved.id,
      }),
      this.integrationsService.emitCustomWebhookEvent(buyerId, 'refund_approved', {
        refund_request_id: saved.id,
        assignment_id: assignment.id,
        lead_id: assignment.lead.id,
        lead_title: assignment.lead.title,
        resolution,
        amount_cents: amount,
        notes: row.admin_notes,
        duplicate_requeued: duplicateRequested,
      }),
    ]);
    return saved;
  }
}
