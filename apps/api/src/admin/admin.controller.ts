import {
  Body,
  Controller,
  Get,
  Ip,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { WalletService } from '../wallet/wallet.service';
import { AuditLogService } from './audit-log.service';
import { AdminCreditWalletDto } from './dto/admin-credit-wallet.dto';
import { UpdateDistributionEngineSettingsDto } from './dto/update-distribution-engine-settings.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributionEngineSettings } from '../entities/distribution-engine-settings.entity';
import { Request } from 'express';

const ENGINE_SETTINGS_ID = '00000000-0000-4000-8000-000000000001';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly walletService: WalletService,
    private readonly auditLogService: AuditLogService,
    @InjectRepository(DistributionEngineSettings)
    private readonly engineSettingsRepo: Repository<DistributionEngineSettings>,
  ) {}

  @Post('wallet/credit')
  async creditWallet(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: AdminCreditWalletDto,
    @Ip() ip: string,
  ) {
    await this.walletService.adminCreditWallet(
      dto.user_id,
      dto.amount_cents,
      dto.description,
    );
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_wallet_credit',
      targetType: 'user',
      targetId: dto.user_id,
      metadata: {
        amount_cents: dto.amount_cents,
        description: dto.description,
      },
      ipAddress: ip,
    });
    return { ok: true };
  }

  @Get('audit-logs')
  getAuditLogs() {
    return this.auditLogService.listRecent(200);
  }

  @Get('distribution-engine/settings')
  async getEngineSettings() {
    let row = await this.engineSettingsRepo.findOne({
      where: { id: ENGINE_SETTINGS_ID },
    });
    if (!row) {
      row = await this.engineSettingsRepo.save(
        this.engineSettingsRepo.create({
          id: ENGINE_SETTINGS_ID,
          queue_paused: false,
          max_auto_distribution_runs: 10,
          cooldown_minutes_between_runs: 15,
          markdown_after_days: 7,
          markdown_percent: 10,
        }),
      );
    }
    return row;
  }

  @Patch('distribution-engine/settings')
  async patchEngineSettings(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: UpdateDistributionEngineSettingsDto,
    @Ip() ip: string,
  ) {
    let row = await this.engineSettingsRepo.findOne({
      where: { id: ENGINE_SETTINGS_ID },
    });
    if (!row) {
      row = this.engineSettingsRepo.create({
        id: ENGINE_SETTINGS_ID,
        queue_paused: false,
        max_auto_distribution_runs: 10,
        cooldown_minutes_between_runs: 15,
        markdown_after_days: 7,
        markdown_percent: 10,
      });
    }
    if (dto.queue_paused !== undefined) row.queue_paused = dto.queue_paused;
    if (dto.max_auto_distribution_runs !== undefined) {
      row.max_auto_distribution_runs = dto.max_auto_distribution_runs;
    }
    if (dto.cooldown_minutes_between_runs !== undefined) {
      row.cooldown_minutes_between_runs = dto.cooldown_minutes_between_runs;
    }
    if (dto.markdown_after_days !== undefined) {
      row.markdown_after_days = dto.markdown_after_days;
    }
    if (dto.markdown_percent !== undefined) {
      row.markdown_percent = dto.markdown_percent;
    }
    const saved = await this.engineSettingsRepo.save(row);
    await this.auditLogService.append({
      actorId: req.user.userId,
      action: 'admin_distribution_engine_patch',
      targetType: 'distribution_engine_settings',
      targetId: ENGINE_SETTINGS_ID,
      metadata: dto as Record<string, any>,
      ipAddress: ip,
    });
    return saved;
  }
}
