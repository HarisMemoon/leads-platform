import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketAlert } from '../entities/market-alert.entity';
import { CreateMarketAlertDto } from './dto/create-market-alert.dto';
import { UpdateMarketAlertDto } from './dto/update-market-alert.dto';

@Injectable()
export class MarketAlertsService {
  constructor(
    @InjectRepository(MarketAlert)
    private readonly alertRepo: Repository<MarketAlert>,
  ) {}

  listForUser(userId: string) {
    return this.alertRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateMarketAlertDto) {
    const row = this.alertRepo.create({
      user: { id: userId } as any,
      market: dto.market,
      filters: dto.filters ?? {},
      delivery_channels: dto.delivery_channels ?? ['email'],
      frequency: dto.frequency,
      dnd_start: dto.dnd_start ?? null,
      dnd_end: dto.dnd_end ?? null,
      max_per_day: dto.max_per_day ?? null,
      is_active: dto.is_active ?? true,
    });
    return this.alertRepo.save(row);
  }

  async update(userId: string, id: string, dto: UpdateMarketAlertDto) {
    const row = await this.alertRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!row) throw new NotFoundException('Alert not found');
    if (row.user.id !== userId) throw new ForbiddenException('Not your alert');

    if (dto.market !== undefined) row.market = dto.market;
    if (dto.filters !== undefined) row.filters = dto.filters;
    if (dto.delivery_channels !== undefined) {
      row.delivery_channels = dto.delivery_channels;
    }
    if (dto.frequency !== undefined) row.frequency = dto.frequency;
    if (dto.dnd_start !== undefined) row.dnd_start = dto.dnd_start ?? null;
    if (dto.dnd_end !== undefined) row.dnd_end = dto.dnd_end ?? null;
    if (dto.max_per_day !== undefined) row.max_per_day = dto.max_per_day ?? null;
    if (dto.is_active !== undefined) row.is_active = dto.is_active;

    return this.alertRepo.save(row);
  }

  async remove(userId: string, id: string) {
    const row = await this.alertRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!row) throw new NotFoundException('Alert not found');
    if (row.user.id !== userId) throw new ForbiddenException('Not your alert');
    await this.alertRepo.remove(row);
    return { ok: true };
  }
}
