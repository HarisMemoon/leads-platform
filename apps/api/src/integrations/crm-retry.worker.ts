import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { User } from '../entities/user.entity';
import { CrmSyncStatus } from '../../common/enums/crm-sync-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { IntegrationsService } from './integrations.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Retry delays in minutes: attempt 1 → 5m, 2 → 30m, 3 → 2h, 4 → 24h */
const RETRY_DELAYS_MINUTES = [5, 30, 120, 1440];
const MAX_RETRIES = RETRY_DELAYS_MINUTES.length;

@Injectable()
export class CrmRetryWorker {
  private readonly logger = new Logger(CrmRetryWorker.name);

  constructor(
    @InjectRepository(LeadAssignment)
    private readonly assignmentRepo: Repository<LeadAssignment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly integrationsService: IntegrationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Runs every 4 minutes — picks up assignments due for a retry attempt. */
  @Cron('*/4 * * * *')
  async retryFailedDeliveries() {
    const now = new Date();

    const due = await this.assignmentRepo.find({
      where: {
        crm_sync_status: CrmSyncStatus.FAILED,
        crm_next_retry_at: LessThanOrEqual(now),
      },
      relations: { buyer: true, lead: true },
      take: 50,
    });

    for (const assignment of due) {
      if (!assignment.buyer?.id || !assignment.lead) continue;

      try {
        const result = await this.integrationsService.emitCustomWebhookEvent(
          assignment.buyer.id,
          'lead_delivered_retry',
          {
            assignment_id: assignment.id,
            lead_id: assignment.lead.id,
            lead_title: assignment.lead.title,
            market: assignment.lead.market,
            lead_type: assignment.lead.lead_type,
            amount_charged_cents: assignment.amount_charged_cents,
            metadata: assignment.lead.metadata ?? {},
          },
        );

        if (result.delivered) {
          assignment.crm_sync_status = CrmSyncStatus.SYNCED;
          assignment.crm_next_retry_at = null;
          assignment.crm_last_error = null;
          await this.assignmentRepo.save(assignment);
          this.logger.log(`CRM retry succeeded for assignment ${assignment.id}`);
        } else {
          await this.scheduleNextRetry(assignment, 'HTTP non-200 response');
        }
      } catch (e) {
        await this.scheduleNextRetry(assignment, e instanceof Error ? e.message : 'unknown error');
      }
    }
  }

  private async scheduleNextRetry(assignment: LeadAssignment, errorMessage: string) {
    const nextAttempt = (assignment.crm_retry_count ?? 0) + 1;
    assignment.crm_retry_count = nextAttempt;
    assignment.crm_last_error = errorMessage;

    if (nextAttempt >= MAX_RETRIES) {
      // All retries exhausted — mark permanently failed on assignment and lead
      assignment.crm_sync_status = CrmSyncStatus.FAILED;
      assignment.crm_next_retry_at = null;
      await this.assignmentRepo.save(assignment);

      // Also flag the lead so admin inventory can filter by CRM failure
      if (assignment.lead?.id) {
        await this.assignmentRepo.manager.query(
          `UPDATE leads SET crm_delivery_failed = true WHERE id = $1`,
          [assignment.lead.id],
        );
      }

      this.logger.warn(
        `CRM delivery permanently failed for assignment ${assignment.id} after ${nextAttempt} attempts`,
      );

      const buyerEmail = assignment.buyer?.email ?? 'unknown';
      const assignmentInfo = `Assignment ${assignment.id} · Buyer: ${buyerEmail} · Lead: ${assignment.lead?.title ?? assignment.lead?.id ?? 'unknown'}`;

      // Notify the customer
      if (assignment.buyer?.id) {
        void this.notificationsService.sendUserEvent({
          userId: assignment.buyer.id,
          type: 'crm_delivery_failed',
          title: 'CRM delivery failed for a lead',
          body: `We were unable to deliver a lead to your CRM after several attempts. The lead is still available in your Newleey dashboard.`,
          emailSubject: 'Action required: CRM lead delivery failed',
          emailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.6">
            <h2 style="color:#ef4444">CRM Delivery Failed</h2>
            <p>We tried to send your lead to your connected CRM ${MAX_RETRIES} times, but it didn't go through.</p>
            <p><strong>The lead is safely stored in your Newleey dashboard</strong> — you haven't lost it.</p>
            <p>Please check your webhook URL in Settings → Integrations and try reconnecting your CRM.</p>
            <a href="${process.env.APP_BASE_URL ?? ''}/settings" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Check CRM Settings →</a>
          </div>`,
        }).catch((e) => this.logger.warn(`CRM failure notification error: ${e instanceof Error ? e.message : e}`));
      }

      // Notify all admin users so they can investigate or manually resend
      void this.userRepo.find({ where: { role: UserRole.ADMIN } }).then((admins) => {
        for (const admin of admins) {
          this.notificationsService.sendUserEvent({
            userId: admin.id,
            type: 'crm_delivery_failed_admin',
            title: `CRM delivery permanently failed — manual review needed`,
            body: `${assignmentInfo}\nError: ${assignment.crm_last_error ?? 'unknown'}\nLead is in buyer dashboard.`,
            emailSubject: `[Admin] CRM delivery permanently failed — manual review needed`,
            emailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.6">
              <h2 style="color:#ef4444">CRM Delivery Failed — Manual Review Needed</h2>
              <p><strong>${assignmentInfo}</strong></p>
              <p>After ${MAX_RETRIES} retry attempts the lead could not be delivered to the customer's CRM.</p>
              <p><strong>Last error:</strong> ${assignment.crm_last_error ?? 'unknown'}</p>
              <p>The lead is still in the customer's dashboard. Review the integration or resend manually from the admin console.</p>
              <a href="${process.env.APP_BASE_URL ?? ''}/admin/console" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Open Admin Console →</a>
            </div>`,
          }).catch(() => {/* swallow — best-effort admin alert */});
        }
      }).catch((e) => this.logger.warn(`Failed to notify admins of CRM failure: ${e instanceof Error ? e.message : e}`));
    } else {
      // Schedule next retry
      const delayMinutes = RETRY_DELAYS_MINUTES[nextAttempt - 1] ?? 1440;
      assignment.crm_next_retry_at = new Date(Date.now() + delayMinutes * 60 * 1000);
      await this.assignmentRepo.save(assignment);
      this.logger.warn(
        `CRM retry ${nextAttempt}/${MAX_RETRIES} failed for assignment ${assignment.id}; next attempt in ${delayMinutes}m`,
      );
    }
  }
}
