import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BuyerPricingRule } from '../entities/buyer-pricing-rule.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { Lead } from '../entities/lead.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { LeadPing } from '../entities/lead-ping.entity';
import { LeadPost } from '../entities/lead-post.entity';
import { PingMatchAudit } from '../entities/ping-match-audit.entity';
import { VendorIntegration } from '../entities/vendor-integration.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { LeadsModule } from '../leads/leads.module';
import { PingAdminController } from './ping-admin.controller';
import { PingEligibilityService } from './ping-eligibility.service';
import { PingMatchingService } from './ping-matching.service';
import { PingService } from './ping.service';
import { PricingRulesController } from './pricing-rules.controller';
import { VendorPingController } from './vendor-ping.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BuyerPricingRule,
      DistributionRule,
      Lead,
      LeadAssignment,
      LeadPing,
      LeadPost,
      PingMatchAudit,
      VendorIntegration,
      WalletAccount,
    ]),
    forwardRef(() => LeadsModule),
  ],
  controllers: [VendorPingController, PricingRulesController, PingAdminController],
  providers: [PingService, PingMatchingService, PingEligibilityService],
  exports: [PingService, PingMatchingService, PingEligibilityService],
})
export class PingModule {}
