import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class DistributionService {
  constructor(
    @InjectQueue('lead-distribution')
    private readonly distributionQueue: Queue,
  ) {}

  async enqueueLeadDistribution(leadId: string, opts?: { delay?: number }) {
    const delay = Math.max(0, opts?.delay ?? 0);
    await this.distributionQueue.add(
      'processLead',
      { leadId },
      { delay, removeOnComplete: true, removeOnFail: false },
    );
  }
}

