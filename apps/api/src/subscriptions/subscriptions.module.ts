import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeModule } from '../stripe/stripe.module';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { User } from '../entities/user.entity';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ProEntitlementService } from './pro-entitlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subscription, SubscriptionPlan]),
    forwardRef(() => StripeModule),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, ProEntitlementService],
  exports: [SubscriptionsService, ProEntitlementService],
})
export class SubscriptionsModule {}

