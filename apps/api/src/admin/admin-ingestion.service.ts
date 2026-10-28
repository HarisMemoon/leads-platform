import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IngestionBatchStatus,
  LeadIngestionBatch,
} from '../entities/lead-ingestion-batch.entity';
import { Lead } from '../entities/lead.entity';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { ExclusivityLevel } from '../../common/enums/exclusivity-level.enum';
import {
  CreateIngestionBatchDto,
  IngestionRowDto,
} from './dto/admin-ingestion.dto';
import { LeadPricingService } from '../lead-pricing/lead-pricing.service';
import { DistributionService } from '../distribution/distribution.service';
import { OutboundPingService } from '../outbound/outbound-ping.service';

const FAILURE_SAMPLE_LIMIT = 25;

@Injectable()
export class AdminIngestionService {
  private readonly logger = new Logger(AdminIngestionService.name);

  constructor(
    @InjectRepository(LeadIngestionBatch)
    private readonly batchRepo: Repository<LeadIngestionBatch>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly leadPricingService: LeadPricingService,
    private readonly distributionService: DistributionService,
    private readonly outboundPingService: OutboundPingService,
  ) {}

  async createBatch(uploadedByUserId: string, dto: CreateIngestionBatchDto) {
    const batch = this.batchRepo.create({
      filename: dto.filename,
      vendor: dto.vendor ?? null,
      status: 'processing' as IngestionBatchStatus,
      total_rows: dto.rows.length,
      processed_rows: 0,
      failed_rows: 0,
      uploaded_by: { id: uploadedByUserId } as any,
      failure_samples: [],
    });
    const saved = await this.batchRepo.save(batch);

    let processed = 0;
    let failed = 0;
    const samples: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < dto.rows.length; i++) {
      try {
        await this.persistRow(dto.rows[i]);
        processed += 1;
      } catch (err) {
        failed += 1;
        if (samples.length < FAILURE_SAMPLE_LIMIT) {
          samples.push({
            row: i + 1,
            reason: err instanceof Error ? err.message : 'unknown error',
          });
        }
      }
    }

    saved.processed_rows = processed;
    saved.failed_rows = failed;
    saved.failure_samples = samples;
    saved.status = (failed === 0 ? 'processed' : processed > 0 ? 'processed' : 'failed') as IngestionBatchStatus;
    saved.processed_at = new Date();
    if (failed > 0 && processed === 0) {
      saved.error_message = `All ${failed} rows failed validation`;
    }
    await this.batchRepo.save(saved);

    return this.formatBatchRow(saved);
  }

  private async persistRow(row: IngestionRowDto) {
    if (row.price_cents < 0) {
      throw new Error('price_cents must be non-negative');
    }
    if (!row.market.trim() || !row.lead_type.trim()) {
      throw new Error('market and lead_type are required');
    }
    const score =
      typeof row.quality_score === 'number'
        ? Math.max(0, Math.min(100, row.quality_score))
        : 50;

    const isExclusive = row.exclusivity_level === 'exclusive';
    const exclusivityLevel = isExclusive ? ExclusivityLevel.EXCLUSIVE : ExclusivityLevel.SHARED;
    // Pricing always from admin-controlled lead_pricing_config — ignore any price in the row
    const { exclusive: exclusivePriceCents, shared: sharedPriceCents } =
      await this.leadPricingService.getPricesForLead(row.lead_type?.trim() ?? 'inbound');

    const lead = this.leadRepo.create({
      title: row.title?.trim() || `${row.lead_type} · ${row.market}`,
      market: row.market.trim(),
      lead_type: row.lead_type.trim(),
      source: row.source?.trim() || 'admin-ingestion',
      status: LeadStatus.AVAILABLE,
      exclusivity_level: exclusivityLevel,
      quality_score: score,
      price_cents: exclusivePriceCents,
      list_price_anchor_cents: exclusivePriceCents,
      exclusive_price_cents: exclusivePriceCents,
      shared_price_cents: isExclusive ? null : sharedPriceCents,
      max_non_exclusive_buyers: isExclusive ? 1 : (row.lead_type?.trim() === 'outbound' ? 3 : 5),
      metadata: {
        // contact
        seller_name: row.seller_name ?? null,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        email: row.contact_email ?? null,
        phone: row.contact_phone ?? null,
        address: row.address ?? null,
        // location
        city: row.city ?? null,
        state: row.state ?? null,
        zip: row.zip ?? null,
        // property
        property_type: row.property_type ?? null,
        condition: row.condition ?? null,
        timeline: row.timeline ?? null,
        notes: row.notes ?? null,
        ingestion_source: 'admin_csv',
      },
    });
    const saved = await this.leadRepo.save(lead);

    // Enqueue auto-distribution + outbound pings — no admin approval needed
    void this.distributionService.enqueueLeadDistribution(saved.id)
      .catch((e) => this.logger.warn(`Distribution enqueue failed for lead ${saved.id}: ${e instanceof Error ? e.message : e}`));
    void this.outboundPingService.pingAll(saved)
      .catch((e) => this.logger.warn(`Outbound ping failed for lead ${saved.id}: ${e instanceof Error ? e.message : e}`));
  }

  async listBatches(limit = 25) {
    const rows = await this.batchRepo.find({
      relations: { uploaded_by: true },
      order: { created_at: 'DESC' },
      take: Math.min(100, Math.max(1, limit)),
    });
    return rows.map((r) => this.formatBatchRow(r));
  }

  async getStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [pendingReview, processedLast24h, failedBatches] = await Promise.all([
      this.batchRepo.count({ where: { status: 'pending' } }),
      this.batchRepo
        .createQueryBuilder('b')
        .where(`b.status = 'processed'`)
        .andWhere('b.processed_at >= :since', { since })
        .getCount(),
      this.batchRepo.count({ where: { status: 'failed' } }),
    ]);
    return { pendingReview, processedLast24h, failedBatches };
  }

  private formatBatchRow(b: LeadIngestionBatch) {
    return {
      id: b.id,
      filename: b.filename,
      vendor: b.vendor,
      status: b.status,
      total_rows: b.total_rows,
      processed_rows: b.processed_rows,
      failed_rows: b.failed_rows,
      error_message: b.error_message,
      failure_samples: b.failure_samples ?? [],
      uploaded_by: b.uploaded_by
        ? { id: b.uploaded_by.id, email: b.uploaded_by.email }
        : null,
      created_at: b.created_at,
      processed_at: b.processed_at,
    };
  }
}
