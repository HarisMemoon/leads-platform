import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserRole } from '../../common/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateVendorIntegrationDto,
  PatchVendorIntegrationDto,
} from './dto/admin-vendor-integration.dto';
import { PingService } from './ping.service';
import { VendorIntegration } from '../entities/vendor-integration.entity';
import { VendorWebhookHit } from '../entities/vendor-webhook-hit.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class PingAdminController {
  constructor(
    private readonly pingService: PingService,
    @InjectRepository(VendorIntegration)
    private readonly vendorRepo: Repository<VendorIntegration>,
    @InjectRepository(VendorWebhookHit)
    private readonly webhookHitRepo: Repository<VendorWebhookHit>,
  ) {}

  @Get('vendors')
  listVendors() {
    return this.pingService.listVendors();
  }

  @Post('vendors')
  createVendor(@Body() dto: CreateVendorIntegrationDto) {
    return this.pingService.createVendor(dto);
  }

  @Patch('vendors/:id')
  patchVendor(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PatchVendorIntegrationDto,
  ) {
    return this.pingService.patchVendor(id, dto);
  }

  @Get('pings')
  listPings(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.pingService.listPings(limit);
  }

  @Get('pings/:id')
  getPing(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pingService.getPing(id);
  }

  @Get('vendors/:id/webhook-hits')
  async getVendorWebhookHits(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.webhookHitRepo.find({
      where: { vendor_id: id },
      order: { created_at: 'DESC' },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  @Get('vendors/:id/payout-stats')
  async getVendorPayoutStats(@Param('id', new ParseUUIDPipe()) id: string) {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const row = await this.webhookHitRepo
      .createQueryBuilder('h')
      .select('COUNT(h.id)', 'total_hits')
      .addSelect(`SUM(CASE WHEN h.status = 'accepted' THEN 1 ELSE 0 END)`, 'accepted')
      .addSelect(`SUM(CASE WHEN h.status = 'rejected' THEN 1 ELSE 0 END)`, 'rejected')
      .where('h.vendor_id = :id', { id })
      .getRawOne<{ total_hits: string; accepted: string; rejected: string }>();

    return {
      vendor_id: id,
      vendor_name: vendor.name,
      total_hits: Number(row?.total_hits ?? 0),
      accepted: Number(row?.accepted ?? 0),
      rejected: Number(row?.rejected ?? 0),
    };
  }
}
