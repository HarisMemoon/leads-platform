import { Controller, Get, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { TermsAcceptance } from '../entities/terms-acceptance.entity';
import { User } from '../entities/user.entity';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('terms')
export class TermsController {
  constructor(
    @InjectRepository(TermsAcceptance)
    private readonly termsRepo: Repository<TermsAcceptance>,
    private readonly config: ConfigService,
  ) {}

  private get currentTermsVersion(): string {
    return this.config.get<string>('TERMS_VERSION') ?? '2025-01';
  }

  /** Check whether the authenticated user has accepted the current terms version. */
  @Get('status')
  async getStatus(@Req() req: Request & { user: { userId: string } }) {
    const version = this.currentTermsVersion;
    const acceptance = await this.termsRepo.findOne({
      where: {
        user: { id: req.user.userId },
        terms_version: version,
      },
    });
    return {
      accepted: acceptance !== null,
      terms_version: version,
      accepted_at: acceptance?.accepted_at ?? null,
    };
  }

  /** Record that the user has accepted the current terms. */
  @Post('accept')
  async accept(
    @Req() req: Request & { user: { userId: string } },
    @Ip() ip: string,
  ) {
    const version = this.currentTermsVersion;
    const existing = await this.termsRepo.findOne({
      where: {
        user: { id: req.user.userId },
        terms_version: version,
      },
    });
    if (existing) {
      return { accepted: true, accepted_at: existing.accepted_at };
    }
    const row = this.termsRepo.create({
      user: { id: req.user.userId } as User,
      terms_version: version,
      ip_address: ip ?? null,
    });
    const saved = await this.termsRepo.save(row);
    return { accepted: true, accepted_at: saved.accepted_at };
  }
}
