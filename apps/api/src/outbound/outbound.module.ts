import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboundBuyerEndpoint } from '../entities/outbound-buyer-endpoint.entity';
import { OutboundPingLog } from '../entities/outbound-ping-log.entity';
import { OutboundPingService } from './outbound-ping.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutboundBuyerEndpoint, OutboundPingLog])],
  providers: [OutboundPingService],
  exports: [OutboundPingService],
})
export class OutboundModule {}
