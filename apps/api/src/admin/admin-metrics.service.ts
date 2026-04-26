import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { LeadRefundRequest } from '../entities/lead-refund-request.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { CrmSyncStatus } from '../../common/enums/crm-sync-status.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

export type AdminMetricsBreakdown = {
  topBuyers: Array<{
    user_id: string;
    email: string;
    total_spend_cents: string;
    assignment_count: number;
  }>;
  soldByType: Array<{
    lead_type: string;
    assignment_count: number;
    revenue_cents: string;
  }>;
  deliverySuccessRate: number;
  contactRate: number;
  mrrEstimateCents: string;
  subscriptionChurn30d: {
    cancelled: number;
    activeAtPeriodStart: number;
    churnRate: number;
  };
  pendingRefundCreditsCents: string;
  duplicateAutoMergedLast7d: number;
  gradingBuckets: { high: number; borderline: number; below: number };
  manualOverridesLast7d: number;
};

const HIGH_CONFIDENCE_MIN_SCORE = 85;
const BORDERLINE_MIN_SCORE = 50;

@Injectable()
export class AdminMetricsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(LeadAssignment)
    private readonly assignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(LeadRefundRequest)
    private readonly refundRepo: Repository<LeadRefundRequest>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
  ) {}

  async getBreakdown(): Promise<AdminMetricsBreakdown> {
    const [
      topBuyers,
      soldByType,
      deliveryAggregate,
      contactAggregate,
      mrrEstimateCents,
      churn,
      pendingRefundCreditsCents,
      duplicateAutoMergedLast7d,
      gradingBuckets,
      manualOverridesLast7d,
    ] = await Promise.all([
      this.computeTopBuyers(10),
      this.computeSoldByType(),
      this.computeDeliveryAggregate(),
      this.computeContactAggregate(),
      this.computeMrrEstimateCents(),
      this.computeSubscriptionChurn(30),
      this.computePendingRefundCreditsCents(),
      this.countDuplicateAutoMergedLast(7),
      this.computeGradingBuckets(),
      this.countGradingOverridesLast(7),
    ]);

    const deliverySuccessRate = deliveryAggregate.total
      ? deliveryAggregate.delivered / deliveryAggregate.total
      : 0;
    const contactRate = contactAggregate.total
      ? contactAggregate.contacted / contactAggregate.total
      : 0;

    return {
      topBuyers,
      soldByType,
      deliverySuccessRate,
      contactRate,
      mrrEstimateCents,
      subscriptionChurn30d: churn,
      pendingRefundCreditsCents,
      duplicateAutoMergedLast7d,
      gradingBuckets,
      manualOverridesLast7d,
    };
  }

  private async computeTopBuyers(limit: number) {
    const rows = await this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoin('a.buyer', 'buyer')
      .select('buyer.id', 'user_id')
      .addSelect('buyer.email', 'email')
      .addSelect('COALESCE(SUM(a.amount_charged_cents), 0)', 'total_spend_cents')
      .addSelect('COUNT(a.id)', 'assignment_count')
      .where('buyer.id IS NOT NULL')
      .groupBy('buyer.id')
      .addGroupBy('buyer.email')
      .orderBy('SUM(a.amount_charged_cents)', 'DESC')
      .limit(limit)
      .getRawMany<{
        user_id: string;
        email: string;
        total_spend_cents: string;
        assignment_count: string;
      }>();

    return rows.map((r) => ({
      user_id: r.user_id,
      email: r.email,
      total_spend_cents: r.total_spend_cents,
      assignment_count: Number(r.assignment_count ?? 0),
    }));
  }

  private async computeSoldByType() {
    const rows = await this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoin('a.lead', 'lead')
      .select('lead.lead_type', 'lead_type')
      .addSelect('COUNT(a.id)', 'assignment_count')
      .addSelect('COALESCE(SUM(a.amount_charged_cents), 0)', 'revenue_cents')
      .where('lead.lead_type IS NOT NULL')
      .groupBy('lead.lead_type')
      .orderBy('COUNT(a.id)', 'DESC')
      .getRawMany<{
        lead_type: string;
        assignment_count: string;
        revenue_cents: string;
      }>();

    return rows.map((r) => ({
      lead_type: r.lead_type,
      assignment_count: Number(r.assignment_count ?? 0),
      revenue_cents: r.revenue_cents,
    }));
  }

  private async computeDeliveryAggregate() {
    const total = await this.assignmentRepo.count();
    if (total === 0) return { total: 0, delivered: 0 };
    const delivered = await this.assignmentRepo.count({
      where: { crm_sync_status: CrmSyncStatus.SYNCED },
    });
    return { total, delivered };
  }

  private async computeContactAggregate() {
    const total = await this.assignmentRepo.count();
    if (total === 0) return { total: 0, contacted: 0 };
    const contacted = await this.assignmentRepo.count({
      where: { twilio_contacted: true },
    });
    return { total, contacted };
  }

  private async computeMrrEstimateCents(): Promise<string> {
    const plans = await this.planRepo.find();
    const planPriceMap = new Map<string, bigint>();
    for (const p of plans) {
      planPriceMap.set(p.plan_type, BigInt(p.monthly_price_cents ?? '0'));
    }

    const rows = await this.subscriptionRepo
      .createQueryBuilder('s')
      .select('s.plan_type', 'plan_type')
      .addSelect('COUNT(*)', 'count')
      .where('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .groupBy('s.plan_type')
      .getRawMany<{ plan_type: string; count: string }>();

    let mrr = 0n;
    for (const row of rows) {
      const price = planPriceMap.get(row.plan_type) ?? 0n;
      mrr += price * BigInt(row.count ?? 0);
    }
    return mrr.toString();
  }

  private async computeSubscriptionChurn(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const cancelled = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SubscriptionStatus.CANCELLED })
      .andWhere('s.updated_at >= :since', { since })
      .getCount();

    const active = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.ACTIVE },
    });
    const denominator = active + cancelled;
    const churnRate = denominator > 0 ? cancelled / denominator : 0;
    return { cancelled, activeAtPeriodStart: denominator, churnRate };
  }

  private async computePendingRefundCreditsCents(): Promise<string> {
    const row = await this.refundRepo
      .createQueryBuilder('r')
      .leftJoin('r.lead_assignment', 'a')
      .select('COALESCE(SUM(a.amount_charged_cents), 0)', 'sum')
      .where(`r.status = 'pending'`)
      .getRawOne<{ sum: string }>();
    return row?.sum ?? '0';
  }

  private async countDuplicateAutoMergedLast(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.leadRepo
      .createQueryBuilder('lead')
      .where('lead.duplicate_of_lead_id IS NOT NULL')
      .andWhere('lead.updated_at >= :since', { since })
      .getCount();
  }

  private async computeGradingBuckets() {
    const buckets = await this.leadRepo
      .createQueryBuilder('lead')
      .select(
        `SUM(CASE WHEN lead.quality_score >= ${HIGH_CONFIDENCE_MIN_SCORE} THEN 1 ELSE 0 END)`,
        'high',
      )
      .addSelect(
        `SUM(CASE WHEN lead.quality_score >= ${BORDERLINE_MIN_SCORE} AND lead.quality_score < ${HIGH_CONFIDENCE_MIN_SCORE} THEN 1 ELSE 0 END)`,
        'borderline',
      )
      .addSelect(
        `SUM(CASE WHEN lead.quality_score < ${BORDERLINE_MIN_SCORE} THEN 1 ELSE 0 END)`,
        'below',
      )
      .getRawOne<{ high: string; borderline: string; below: string }>();

    return {
      high: Number(buckets?.high ?? 0),
      borderline: Number(buckets?.borderline ?? 0),
      below: Number(buckets?.below ?? 0),
    };
  }

  private async countGradingOverridesLast(days: number): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const result = await this.leadRepo.manager.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM "lead_grade_overrides" WHERE "created_at" >= $1`,
      [since],
    );
    return Number(result?.[0]?.count ?? 0);
  }
}
