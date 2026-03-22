import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { OnboardingModule } from './onboarding/onboarding.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [

    /*
    Environment configuration
    */

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    /*
    Database connection
    */

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService) => {

        const databaseUrl = config.get<string>('DATABASE_URL')

        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not defined')
        }

        return {

          type: 'postgres',

          url: databaseUrl,

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
  ],

  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}