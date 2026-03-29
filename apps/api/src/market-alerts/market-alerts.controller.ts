import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { MarketAlertsService } from './market-alerts.service';
import { CreateMarketAlertDto } from './dto/create-market-alert.dto';
import { UpdateMarketAlertDto } from './dto/update-market-alert.dto';
import { Request } from 'express';

@Controller('market-alerts')
export class MarketAlertsController {
  constructor(private readonly marketAlertsService: MarketAlertsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Get('me')
  listMine(@Req() req: Request & { user: { userId: string } }) {
    return this.marketAlertsService.listForUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Post()
  create(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: CreateMarketAlertDto,
  ) {
    return this.marketAlertsService.create(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Patch(':id')
  update(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMarketAlertDto,
  ) {
    return this.marketAlertsService.update(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Delete(':id')
  remove(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.marketAlertsService.remove(req.user.userId, id);
  }
}
