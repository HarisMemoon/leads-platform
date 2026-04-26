import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { GhlSyncStatus } from '../../common/enums/ghl-sync-status.enum';
import { CrmSyncStatus } from '../../common/enums/crm-sync-status.enum';
import { IntegrationsService } from '../integrations/integrations.service';
import { GhlOutboundService } from '../integrations/ghl-outbound.service';

@Injectable()
export class CrmGhlSyncWorker {
  private readonly logger = new Logger(CrmGhlSyncWorker.name);

  constructor(
    @InjectRepository(LeadAssignment)
    private readonly assignmentRepo: Repository<LeadAssignment>,
    private readonly integrationsService: IntegrationsService,
    private readonly ghlOutbound: GhlOutboundService,
  ) {}

  @Cron('*/2 * * * *')
  async processPendingSync() {
    const pending = await this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.lead', 'lead')
      .leftJoinAndSelect('a.buyer', 'buyer')
      .where('a.ghl_sync_status = :gp', { gp: GhlSyncStatus.PENDING })
      .orWhere('a.crm_sync_status = :cp', { cp: CrmSyncStatus.PENDING })
      .orderBy('a.created_at', 'ASC')
      .take(25)
      .getMany();

    for (const a of pending) {
      const payload = {
        assignment_id: a.id,
        buyer_id: a.buyer?.id,
        buyer_email: a.buyer?.email,
        purchase_type: a.purchase_type,
        amount_charged_cents: a.amount_charged_cents,
        lifecycle_phase: a.lifecycle_phase,
        lead: a.lead
          ? {
              id: a.lead.id,
              title: a.lead.title,
              market: a.lead.market,
              lead_type: a.lead.lead_type,
              status: a.lead.status,
              exclusivity_level: a.lead.exclusivity_level,
              metadata: a.lead.metadata ?? {},
            }
          : null,
      };

      if (a.ghl_sync_status === GhlSyncStatus.PENDING) {
        const ghlResult = await this.ghlOutbound.emitWithStatus(
          'lead_assignment_sync',
          payload,
        );
        if (ghlResult.skipped) {
          this.logger.debug(
            `Skipping GHL sync for assignment ${a.id}; ADMIN_OUTBOUND_WEBHOOK_URL is not configured.`,
          );
          a.ghl_sync_status = GhlSyncStatus.SYNCED;
        } else {
          a.ghl_sync_status = ghlResult.delivered
            ? GhlSyncStatus.SYNCED
            : GhlSyncStatus.FAILED;
        }
      }
      if (a.crm_sync_status === CrmSyncStatus.PENDING) {
        const crmResult = a.buyer?.id
          ? await this.integrationsService.emitCustomWebhookEvent(
              a.buyer.id,
              'lead_assignment_sync',
              payload,
            )
          : { delivered: false, skipped: true, status: null };

        if (crmResult.skipped) {
          a.crm_sync_status = CrmSyncStatus.SKIPPED;
        } else {
          a.crm_sync_status = crmResult.delivered
            ? CrmSyncStatus.SYNCED
            : CrmSyncStatus.FAILED;
        }
      }
      await this.assignmentRepo.save(a);
    }

    if (pending.length > 0) {
      this.logger.debug(`CRM/GHL sync processed ${pending.length} assignment(s)`);
    }
  }
}
