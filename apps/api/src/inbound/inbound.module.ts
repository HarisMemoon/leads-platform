import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../entities/lead.entity';
import { VendorIntegration } from '../entities/vendor-integration.entity';
import { VendorWebhookHit } from '../entities/vendor-webhook-hit.entity';
import { InboundService } from './inbound.service';
import { InboundController } from './inbound.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, VendorIntegration, VendorWebhookHit]),
  ],
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}
