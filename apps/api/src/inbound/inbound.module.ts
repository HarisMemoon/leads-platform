import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../entities/lead.entity';
import { VendorIntegration } from '../entities/vendor-integration.entity';
import { VendorWebhookHit } from '../entities/vendor-webhook-hit.entity';
import { InboundService } from './inbound.service';
import { InboundController } from './inbound.controller';
import { LeadPricingModule } from '../lead-pricing/lead-pricing.module';
import { DistributionModule } from '../distribution/distribution.module';
import { OutboundModule } from '../outbound/outbound.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, VendorIntegration, VendorWebhookHit]),
    LeadPricingModule,
    forwardRef(() => DistributionModule),
    OutboundModule,
  ],
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}
