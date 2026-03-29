import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketAlert } from '../entities/market-alert.entity';
import { MarketAlertsService } from './market-alerts.service';
import { MarketAlertsController } from './market-alerts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MarketAlert])],
  controllers: [MarketAlertsController],
  providers: [MarketAlertsService],
  exports: [MarketAlertsService],
})
export class MarketAlertsModule {}
