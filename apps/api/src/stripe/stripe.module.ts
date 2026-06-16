import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { SubscriptionReminderWorker } from './subscription-reminder.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      WalletAccount,
      Subscription,
      SubscriptionPlan,
      DistributionRule,
    ]),
    forwardRef(() => WalletModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [StripeController],
  providers: [StripeService, SubscriptionReminderWorker],
  exports: [StripeService],
})
export class StripeModule {}
