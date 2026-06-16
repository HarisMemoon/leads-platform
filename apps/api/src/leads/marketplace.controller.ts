import {
  BadRequestException,
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
import { IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { LeadsService, ExclusivityChoice } from './leads.service';
import { ListMarketplaceLeadsDto } from './dto/list-marketplace-leads.dto';
import { ListMyLeadsDto } from './dto/list-my-leads.dto';
import { PatchAssignmentLifecycleDto } from './dto/patch-assignment-lifecycle.dto';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto';
import { RefundRequestsService } from './refund-requests.service';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadPricingConfig } from '../entities/lead-pricing-config.entity';

class BuyLeadDto {
  @IsOptional()
  @IsIn(['exclusive', 'non_exclusive'])
  exclusivity_choice?: ExclusivityChoice;
}

class QuoteQueryDto {
  @IsOptional()
  @IsIn(['exclusive', 'non_exclusive'])
  choice?: ExclusivityChoice;
}

@Controller('leads')
export class MarketplaceController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly refundRequestsService: RefundRequestsService,
    @InjectRepository(LeadPricingConfig)
    private readonly pricingConfigRepo: Repository<LeadPricingConfig>,
  ) {}

  /** Public pricing endpoint — returns current inbound/outbound pricing config */
  @Get('pricing-config')
  getPricingConfig() {
    return this.pricingConfigRepo.find({ order: { lead_type: 'ASC' } });
  }

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
    const has =
      dto.lifecycle_phase != null ||
      dto.contract_price_cents !== undefined ||
      dto.sell_price_cents !== undefined ||
      dto.buyer_notes !== undefined;
    if (!has) {
      throw new BadRequestException('No updates provided');
    }
    return this.leadsService.updateMyAssignmentLifecycle(
      req.user.userId,
      assignmentId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Post('me/refund-requests')
  createRefundRequest(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: CreateRefundRequestDto,
  ) {
    return this.refundRequestsService.createForBuyer(
      req.user.userId,
      dto.assignment_id,
      dto.reason,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Get('me/refund-requests')
  listMyRefundRequests(@Req() req: Request & { user: { userId: string } }) {
    return this.refundRequestsService.listMine(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Post(':id/buy')
  buy(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BuyLeadDto,
  ) {
    return this.leadsService.buyLead(
      req.user.userId,
      id,
      undefined,
      dto.exclusivity_choice ?? 'non_exclusive',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Get(':id/quote')
  getQuote(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QuoteQueryDto,
  ) {
    return this.leadsService.getLeadQuote(
      req.user.userId,
      id,
      query.choice ?? 'non_exclusive',
    );
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @Patch(':id/exclusive-buyout')
  exclusiveBuyout(
    @Req() req: Request & { user: { userId: string } },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.leadsService.exclusiveBuyout(req.user.userId, id);
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

