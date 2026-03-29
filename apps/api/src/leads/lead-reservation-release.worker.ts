import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { LeadStatus } from '../../common/enums/lead-status.enum';

@Injectable()
export class LeadReservationReleaseWorker {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
  ) {}

  @Cron('*/1 * * * *')
  async releaseExpiredHolds() {
    await this.leadRepo.query(
      `UPDATE leads
       SET status = $1, reserved_until = NULL, reserved_by_user_id = NULL
       WHERE status = $2 AND reserved_until IS NOT NULL AND reserved_until < NOW()`,
      [LeadStatus.AVAILABLE, LeadStatus.RESERVED],
    );
  }
}
