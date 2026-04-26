import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../entities/integration.entity';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { IntegrationStatus } from '../../common/enums/integration-status.enum';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepo: Repository<Integration>,
  ) {}

  private async getOrCreateWebhookRow(userId: string) {
    let row = await this.integrationRepo.findOne({
      where: { user: { id: userId }, provider: IntegrationProvider.CUSTOM_WEBHOOK },
    });
    if (!row) {
      row = this.integrationRepo.create({
        user: { id: userId } as any,
        provider: IntegrationProvider.CUSTOM_WEBHOOK,
        status: IntegrationStatus.DISCONNECTED,
        config: {},
      });
      await this.integrationRepo.save(row);
    }
    return row;
  }

  async getWebhookIntegration(userId: string) {
    const row = await this.getOrCreateWebhookRow(userId);
    return {
      id: row.id,
      webhook_url: (row.config?.webhookUrl as string) ?? '',
      status: row.status,
    };
  }

  async setWebhookUrl(userId: string, url: string | null) {
    const row = await this.getOrCreateWebhookRow(userId);
    const trimmed = (url ?? '').trim();
    if (trimmed) {
      try {
        // eslint-disable-next-line no-new
        new URL(trimmed);
      } catch {
        throw new BadRequestException('Invalid webhook URL');
      }
    }
    row.config = { ...row.config, webhookUrl: trimmed };
    row.status = trimmed ? IntegrationStatus.CONNECTED : IntegrationStatus.DISCONNECTED;
    await this.integrationRepo.save(row);
    return this.getWebhookIntegration(userId);
  }

  async testWebhook(userId: string) {
    const row = await this.getOrCreateWebhookRow(userId);
    const webhookUrl = (row?.config?.webhookUrl as string | undefined)?.trim();
    if (!webhookUrl) {
      throw new BadRequestException('Save a webhook URL first');
    }
    const payload = {
      event: 'crm_webhook_test',
      message: 'Test event from Newleey',
      sent_at: new Date().toISOString(),
    };
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      clearTimeout(t);
      return { ok: res.ok, status: res.status };
    } catch (e) {
      clearTimeout(t);
      throw new BadRequestException(
        `Webhook test failed: ${e instanceof Error ? e.message : 'unknown error'}`,
      );
    }
  }

  async emitCustomWebhookEvent(
    userId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<{ delivered: boolean; skipped: boolean; status: number | null }> {
    const row = await this.getOrCreateWebhookRow(userId);
    const webhookUrl = (row.config?.webhookUrl as string | undefined)?.trim();
    if (!webhookUrl) {
      return { delivered: false, skipped: true, status: null };
    }

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          emitted_at: new Date().toISOString(),
          payload,
        }),
        signal: ac.signal,
      });
      clearTimeout(t);
      row.last_sync_at = new Date();
      row.status = res.ok ? IntegrationStatus.CONNECTED : IntegrationStatus.ERROR;
      await this.integrationRepo.save(row);
      if (!res.ok) {
        this.logger.warn(`Webhook event "${event}" failed with HTTP ${res.status}`);
      }
      return { delivered: res.ok, skipped: false, status: res.status };
    } catch (e) {
      clearTimeout(t);
      row.status = IntegrationStatus.ERROR;
      await this.integrationRepo.save(row);
      this.logger.warn(
        `Webhook event "${event}" failed: ${e instanceof Error ? e.message : e}`,
      );
      return { delivered: false, skipped: false, status: null };
    }
  }
}
