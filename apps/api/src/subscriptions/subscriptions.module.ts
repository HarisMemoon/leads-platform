import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeModule } from '../stripe/stripe.module';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { LeadPricingConfig } from '../entities/lead-pricing-config.entity';
import { User } from '../entities/user.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ProEntitlementService } from './pro-entitlement.service';
import { SubscriptionExpiryWorker } from './subscription-expiry.worker';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subscription, SubscriptionPlan, LeadPricingConfig, DistributionRule]),
    forwardRef(() => StripeModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, ProEntitlementService, SubscriptionExpiryWorker],
  exports: [SubscriptionsService, ProEntitlementService],
})
export class SubscriptionsModule {}

