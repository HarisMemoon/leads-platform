import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../entities/lead.entity';
import { Subscription } from '../entities/subscription.entity';
import { DistributionRule } from '../entities/distribution-rule.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { DistributionService } from './distribution.service';
import { LeadDistributionProcessor } from './lead-distribution.processor';
import { LeadsModule } from '../leads/leads.module';
import { AutoReloadWorker } from './auto-reload.worker';
import { StripeModule } from '../stripe/stripe.module';
import { DistributionRulesController } from './distribution-rules.controller';
import { DistributionRulesService } from './distribution-rules.service';
import { CrmGhlSyncWorker } from './crm-ghl-sync.worker';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL is not defined');
        }

        const parsed = new URL(redisUrl);
        const db = parsed.pathname?.replace('/', '');

        return {
          redis: {
            host: parsed.hostname,
            port: Number(parsed.port || 6379),
            username: parsed.username || undefined,
            password: parsed.password || undefined,
            db: db ? Number(db) : 0,
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'lead-distribution',
    }),
    TypeOrmModule.forFeature([
      Lead,
      Subscription,
      DistributionRule,
      WalletAccount,
      LeadAssignment,
      DistributionEngineSettings,
    ]),
    forwardRef(() => LeadsModule),
    StripeModule,
  ],
  controllers: [DistributionRulesController],
  providers: [
    DistributionService,
    LeadDistributionProcessor,
    AutoReloadWorker,
    DistributionRulesService,
    CrmGhlSyncWorker,
  ],
  exports: [DistributionService, DistributionRulesService],
})
export class DistributionModule {}
