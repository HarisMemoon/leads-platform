import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { GhlSyncStatus } from '../../common/enums/ghl-sync-status.enum';
import { CrmSyncStatus } from '../../common/enums/crm-sync-status.enum';

@Injectable()
export class CrmGhlSyncWorker {
  private readonly logger = new Logger(CrmGhlSyncWorker.name);

  constructor(
    @InjectRepository(LeadAssignment)
    private readonly assignmentRepo: Repository<LeadAssignment>,
  ) {}

  @Cron('*/2 * * * *')
  async processPendingSync() {
    const pending = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.ghl_sync_status = :gp', { gp: GhlSyncStatus.PENDING })
      .orWhere('a.crm_sync_status = :cp', { cp: CrmSyncStatus.PENDING })
      .orderBy('a.created_at', 'ASC')
      .take(25)
      .getMany();

    for (const a of pending) {
      if (a.ghl_sync_status === GhlSyncStatus.PENDING) {
        a.ghl_sync_status = GhlSyncStatus.SYNCED;
      }
      if (a.crm_sync_status === CrmSyncStatus.PENDING) {
        a.crm_sync_status = CrmSyncStatus.SYNCED;
      }
      await this.assignmentRepo.save(a);
    }

    if (pending.length > 0) {
      this.logger.debug(`Stub CRM/GHL sync processed ${pending.length} assignment(s)`);
    }
  }
}
