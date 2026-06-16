import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadPricingConfig } from '../entities/lead-pricing-config.entity';
import { LeadPricingService } from './lead-pricing.service';

@Module({
  imports: [TypeOrmModule.forFeature([LeadPricingConfig])],
  providers: [LeadPricingService],
  exports: [LeadPricingService],
})
export class LeadPricingModule {}
