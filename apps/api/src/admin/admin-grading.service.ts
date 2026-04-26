import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { LeadGradeOverride } from '../entities/lead-grade-override.entity';

const HIGH_MIN = 85;
const BORDERLINE_MIN = 50;

export type GradingBucket = 'high' | 'borderline' | 'below';

@Injectable()
export class AdminGradingService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(LeadGradeOverride)
    private readonly overrideRepo: Repository<LeadGradeOverride>,
  ) {}

  async getQueue(opts: { bucket?: GradingBucket; limit?: number; page?: number }) {
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
    const page = Math.max(1, opts.page ?? 1);
    const skip = (page - 1) * limit;

    const qb = this.leadRepo
      .createQueryBuilder('lead')
      .select([
        'lead.id',
        'lead.title',
        'lead.market',
        'lead.lead_type',
        'lead.status',
        'lead.quality_score',
        'lead.price_cents',
        'lead.created_at',
      ])
      .orderBy('lead.quality_score', 'ASC')
      .addOrderBy('lead.created_at', 'DESC');

    if (opts.bucket === 'high') {
      qb.where('lead.quality_score >= :min', { min: HIGH_MIN });
    } else if (opts.bucket === 'borderline') {
      qb.where('lead.quality_score >= :lo AND lead.quality_score < :hi', {
        lo: BORDERLINE_MIN,
        hi: HIGH_MIN,
      });
    } else if (opts.bucket === 'below') {
      qb.where('lead.quality_score < :min', { min: BORDERLINE_MIN });
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      items: items.map((l) => ({
        id: l.id,
        title: l.title,
        market: l.market,
        lead_type: l.lead_type,
        status: l.status,
        quality_score: l.quality_score,
        price_cents: l.price_cents,
        created_at: l.created_at,
      })),
      pagination: { page, limit, total },
    };
  }

  async getStats(days = 7) {
    const buckets = await this.leadRepo
      .createQueryBuilder('lead')
      .select(
        `SUM(CASE WHEN lead.quality_score >= ${HIGH_MIN} THEN 1 ELSE 0 END)`,
        'high',
      )
      .addSelect(
        `SUM(CASE WHEN lead.quality_score >= ${BORDERLINE_MIN} AND lead.quality_score < ${HIGH_MIN} THEN 1 ELSE 0 END)`,
        'borderline',
      )
      .addSelect(
        `SUM(CASE WHEN lead.quality_score < ${BORDERLINE_MIN} THEN 1 ELSE 0 END)`,
        'below',
      )
      .getRawOne<{ high: string; borderline: string; below: string }>();

    const since = new Date();
    since.setDate(since.getDate() - days);
    const overrides = await this.overrideRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :since', { since })
      .getCount();

    return {
      buckets: {
        high: Number(buckets?.high ?? 0),
        borderline: Number(buckets?.borderline ?? 0),
        below: Number(buckets?.below ?? 0),
      },
      manualOverridesLastWindowDays: days,
      manualOverridesCount: overrides,
    };
  }

  async createOverride(reviewerId: string, leadId: string, overrideScore: number, notes?: string) {
    const lead = await this.leadRepo.findOne({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    const original = lead.quality_score;
    const override = this.overrideRepo.create({
      lead: { id: leadId } as any,
      original_score: original,
      override_score: overrideScore,
      notes: notes ?? null,
      reviewer: reviewerId ? ({ id: reviewerId } as any) : null,
    });
    const saved = await this.overrideRepo.save(override);
    lead.quality_score = overrideScore;
    await this.leadRepo.save(lead);
    return {
      id: saved.id,
      lead_id: leadId,
      original_score: original,
      override_score: overrideScore,
      created_at: saved.created_at,
    };
  }

  async listOverrides(limit = 50) {
    const rows = await this.overrideRepo.find({
      relations: { lead: true, reviewer: true },
      order: { created_at: 'DESC' },
      take: Math.min(200, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: r.id,
      lead: r.lead ? { id: r.lead.id, title: r.lead.title } : null,
      original_score: r.original_score,
      override_score: r.override_score,
      notes: r.notes,
      reviewer: r.reviewer ? { id: r.reviewer.id, email: r.reviewer.email } : null,
      created_at: r.created_at,
    }));
  }
}
