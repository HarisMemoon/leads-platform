import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Integration } from '../entities/integration.entity';
import { LeadAssignment } from '../entities/lead-assignment.entity';
import { User } from '../entities/user.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { GhlOutboundService } from './ghl-outbound.service';
import { CrmRetryWorker } from './crm-retry.worker';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, LeadAssignment, User]),
    NotificationsModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, GhlOutboundService, CrmRetryWorker],
  exports: [IntegrationsService, GhlOutboundService],
})
export class IntegrationsModule {}
