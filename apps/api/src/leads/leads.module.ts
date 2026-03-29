import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../entities/lead.entity';
import { LeadPriceHistory } from '../entities/lead-price-history.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { LeadAssignmentEvent } from '../entities/lead-assignment-event.entity';
import { Subscription } from '../entities/subscription.entity';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { WalletModule } from '../wallet/wallet.module';
import { MarketplaceController } from './marketplace.controller';
import { DistributionModule } from '../distribution/distribution.module';
import { LeadPricingService } from './lead-pricing.service';
import { LeadMarkdownWorker } from './lead-markdown.worker';
import { LeadReservationReleaseWorker } from './lead-reservation-release.worker';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lead,
      LeadPriceHistory,
      WalletTransaction,
      LeadAssignment,
      LeadAssignmentEvent,
      Subscription,
      DistributionEngineSettings,
    ]),
    WalletModule,
    NotificationsModule,
    forwardRef(() => DistributionModule),
  ],
  controllers: [LeadsController, MarketplaceController],
  providers: [
    LeadsService,
    LeadPricingService,
    LeadMarkdownWorker,
    LeadReservationReleaseWorker,
  ],
  exports: [LeadsService, LeadPricingService],
})
export class LeadsModule {}
