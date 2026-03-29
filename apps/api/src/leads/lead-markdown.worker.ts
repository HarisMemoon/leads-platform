import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeadPricingService } from './lead-pricing.service';

@Injectable()
export class LeadMarkdownWorker {
  private readonly logger = new Logger(LeadMarkdownWorker.name);

  constructor(private readonly leadPricingService: LeadPricingService) {}

  @Cron('0 7 * * *')
  async runDailyMarkdown() {
    try {
      const n = await this.leadPricingService.markdownAgedAvailableLeads();
      if (n > 0) {
        this.logger.log(`Markdown applied to ${n} lead(s)`);
      }
    } catch (e) {
      this.logger.error(
        e instanceof Error ? e.message : 'markdown job failed',
        e instanceof Error ? e.stack : undefined,
      );
    }
  }
}
