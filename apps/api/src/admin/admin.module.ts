import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletModule } from '../wallet/wallet.module';
import { AuditLog } from '../entities/audit-log.entity';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { AuditLogService } from './audit-log.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, DistributionEngineSettings]),
    WalletModule,
  ],
  controllers: [AdminController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AdminModule {}
