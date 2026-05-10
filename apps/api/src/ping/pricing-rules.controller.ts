import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { UserRole } from '../../common/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertBuyerPricingRuleDto } from './dto/buyer-pricing-rule.dto';
import { PingService } from './ping.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUYER)
@Controller('distribution/pricing-rules')
export class PricingRulesController {
  constructor(private readonly pingService: PingService) {}

  @Get('me')
  listMine(@Req() req: Request & { user: { userId: string } }) {
    return this.pingService.listPricingRules(req.user.userId);
  }

  @Patch('me')
  upsertMine(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: UpsertBuyerPricingRuleDto,
  ) {
    return this.pingService.upsertPricingRule(req.user.userId, dto);
  }

  @Delete(':id')
  deleteMine(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.pingService.deletePricingRule(req.user.userId, id);
  }
}
