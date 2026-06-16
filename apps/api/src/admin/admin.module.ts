import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletModule } from '../wallet/wallet.module';
import { AuditLog } from '../entities/audit-log.entity';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { User } from '../entities/user.entity';
import { ResourcesContent } from '../entities/resources-content.entity';
import { Lead } from '../entities/lead.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { LeadRefundRequest } from '../entities/lead-refund-request.entity';
import { LeadIngestionBatch } from '../entities/lead-ingestion-batch.entity';
import { LeadGradeOverride } from '../entities/lead-grade-override.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { VendorIntegration } from '../entities/vendor-integration.entity';
import { LeadPricingConfig } from '../entities/lead-pricing-config.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { LeadPricingModule } from '../lead-pricing/lead-pricing.module';
import { AuditLogService } from './audit-log.service';
import { AdminController } from './admin.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminIngestionService } from './admin-ingestion.service';
import { AdminGradingService } from './admin-grading.service';
import { AdminIntegrationsHealthService } from './admin-integrations-health.service';
import { AdminPlansService } from './admin-plans.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LeadsModule } from '../leads/leads.module';
import { OutboundModule } from '../outbound/outbound.module';
import { DistributionModule } from '../distribution/distribution.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      AuditLog,
      DistributionEngineSettings,
      User,
      ResourcesContent,
      Lead,
      LeadAssignment,
      LeadRefundRequest,
      LeadIngestionBatch,
      LeadGradeOverride,
      Subscription,
      SubscriptionPlan,
      VendorIntegration,
      LeadPricingConfig,
      LeadAssignment,
      DistributionRule,
    ]),
    WalletModule,
    IntegrationsModule,
    LeadsModule,
    OutboundModule,
    LeadPricingModule,
    forwardRef(() => DistributionModule),
  ],
  controllers: [AdminController],
  providers: [
    AuditLogService,
    AdminMetricsService,
    AdminIngestionService,
    AdminGradingService,
    AdminIntegrationsHealthService,
    AdminPlansService,
  ],
  exports: [AuditLogService],
})
export class AdminModule {}
