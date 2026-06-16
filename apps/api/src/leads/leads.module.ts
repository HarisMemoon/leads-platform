import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../entities/lead.entity';
import { LeadPriceHistory } from '../entities/lead-price-history.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { LeadAssignmentEvent } from '../entities/lead-assignment-event.entity';
import { LeadRefundRequest } from '../entities/lead-refund-request.entity';
import { Subscription } from '../entities/subscription.entity';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { LeadPricingConfig } from '../entities/lead-pricing-config.entity';
import { LeadPricingModule } from '../lead-pricing/lead-pricing.module';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { WalletModule } from '../wallet/wallet.module';
import { MarketplaceController } from './marketplace.controller';
import { DistributionModule } from '../distribution/distribution.module';
import { LeadPricingService } from './lead-pricing.service';
import { LeadMarkdownWorker } from './lead-markdown.worker';
import { LeadReservationReleaseWorker } from './lead-reservation-release.worker';
import { NotificationsModule } from '../notifications/notifications.module';
import { RefundRequestsService } from './refund-requests.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lead,
      LeadPriceHistory,
      WalletTransaction,
      LeadAssignment,
      LeadAssignmentEvent,
      LeadRefundRequest,
      Subscription,
      DistributionEngineSettings,
      DistributionRule,
      LeadPricingConfig,
    ]),
    WalletModule,
    NotificationsModule,
    IntegrationsModule,
    forwardRef(() => DistributionModule),
    forwardRef(() => SubscriptionsModule),
    LeadPricingModule,
  ],
  controllers: [LeadsController, MarketplaceController],
  providers: [
    LeadsService,
    LeadPricingService,
    LeadMarkdownWorker,
    LeadReservationReleaseWorker,
    RefundRequestsService,
  ],
  exports: [LeadsService, LeadPricingService, RefundRequestsService],
})
export class LeadsModule {}
