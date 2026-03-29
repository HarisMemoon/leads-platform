import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { DistributionRulesService } from './distribution-rules.service';
import { UpdateDistributionRuleDto } from './dto/update-distribution-rule.dto';
import { Request } from 'express';

@Controller('distribution')
export class DistributionRulesController {
  constructor(private readonly distributionRulesService: DistributionRulesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Get('rules/me')
  myRules(@Req() req: Request & { user: { userId: string } }) {
    return this.distributionRulesService.listForUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Patch('rules/:id')
  patchRule(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDistributionRuleDto,
  ) {
    return this.distributionRulesService.updateOwnRule(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Get('me')
  getMe(@Req() req: Request & { user: { userId: string } }) {
    return this.distributionRulesService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Patch('me')
  patchMe(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: UpdateDistributionRuleDto,
  ) {
    return this.distributionRulesService.upsertMe(req.user.userId, dto);
  }
}
