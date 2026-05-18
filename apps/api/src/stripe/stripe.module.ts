import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { WalletModule } from '../wallet/wallet.module';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, WalletAccount, Subscription, SubscriptionPlan]),
    forwardRef(() => WalletModule),
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}

