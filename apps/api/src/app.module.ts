import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduleModule } from '@nestjs/schedule'
import { resolvePostgresUrlForIpv4Egress } from './database/resolve-postgres-url-ipv4'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { OnboardingModule } from './onboarding/onboarding.module';
import { WalletModule } from './wallet/wallet.module';
import { LeadsModule } from './leads/leads.module';
import { AdminModule } from './admin/admin.module';
import { DistributionModule } from './distribution/distribution.module';
import { StripeModule } from './stripe/stripe.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { MarketAlertsModule } from './market-alerts/market-alerts.module';

@Module({
  imports: [

    /*
    Environment configuration
    */

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),

    /*
    Database connection
    */

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: async (config: ConfigService) => {
        const { url, ssl } = await resolvePostgresUrlForIpv4Egress(
          config.get<string>('DATABASE_URL'),
        )

        return {

          type: 'postgres',

          url,

          ...(ssl !== undefined ? { ssl } : {}),

          /*
          Auto load entities from modules
          */

          autoLoadEntities: true,

          /*
          NEVER enable in production
          */

          synchronize: false,

          /*
          Logging useful during development
          */

          logging: ['error', 'warn'],

          /*
          Migration settings
          */

          migrationsRun: true,

          migrations: [
            __dirname + '/database/migrations/*.{ts,js}'
          ],

          /*
          Connection stability
          */

          retryAttempts: 5,
          retryDelay: 3000,
        }
      },
    }),

    AuthModule,
    OnboardingModule,
    WalletModule,
    LeadsModule,
    AdminModule,
    DistributionModule,
    StripeModule,
    SubscriptionsModule,
    MarketAlertsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}