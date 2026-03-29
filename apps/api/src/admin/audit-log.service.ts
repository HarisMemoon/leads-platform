import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async append(opts: {
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, any>;
    ipAddress?: string | null;
  }) {
    const row = this.auditRepo.create({
      actor: opts.actorId ? ({ id: opts.actorId } as any) : null,
      action: opts.action,
      target_type: opts.targetType,
      target_id: opts.targetId,
      metadata: opts.metadata ?? {},
      ip_address: opts.ipAddress ?? null,
    });
    return this.auditRepo.save(row);
  }

  async listRecent(limit = 100) {
    return this.auditRepo.find({
      order: { created_at: 'DESC' },
      take: limit,
      relations: { actor: true },
    });
  }
}
