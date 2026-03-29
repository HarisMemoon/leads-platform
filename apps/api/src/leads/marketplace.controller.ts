import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { LeadsService } from './leads.service';
import { ListMarketplaceLeadsDto } from './dto/list-marketplace-leads.dto';
import { ListMyLeadsDto } from './dto/list-my-leads.dto';
import { PatchAssignmentLifecycleDto } from './dto/patch-assignment-lifecycle.dto';
import { Request } from 'express';

@Controller('leads')
export class MarketplaceController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get('marketplace')
  listMarketplace(@Query() query: ListMarketplaceLeadsDto) {
    return this.leadsService.listMarketplaceLeads(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Post(':id/reserve')
  reserve(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.leadsService.reserveLead(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Patch('me/assignments/:assignmentId/lifecycle')
  patchAssignmentLifecycle(
    @Req() req: Request & { user: { userId: string } },
    @Param('assignmentId', new ParseUUIDPipe()) assignmentId: string,
    @Body() dto: PatchAssignmentLifecycleDto,
  ) {
    return this.leadsService.updateMyAssignmentLifecycle(
      req.user.userId,
      assignmentId,
      dto.lifecycle_phase,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Post(':id/buy')
  buy(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.leadsService.buyLead(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Get('me')
  myLeads(
    @Req() req: Request & { user: { userId: string } },
    @Query() query: ListMyLeadsDto,
  ) {
    return this.leadsService.getMyLeads(req.user.userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getLeadDetail(
    @Req() req: Request & { user: { userId: string; role: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.leadsService.getLeadDetail(id, req.user.userId, req.user.role);
  }
}

