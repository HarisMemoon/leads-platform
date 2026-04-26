import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { AppendPriceHistoryDto } from './dto/append-price-history.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RefundRequestsService } from './refund-requests.service';
import { AdminResolveRefundDto } from './dto/admin-resolve-refund.dto';
import { MarkDuplicateLeadDto } from './dto/mark-duplicate-lead.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly refundRequestsService: RefundRequestsService,
  ) {}

  @Post('leads')
  createLead(@Body() dto: CreateLeadDto) {
    return this.leadsService.createLead(dto);
  }

  @Patch('leads/:id')
  updateLead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.updateLead(id, dto);
  }

  @Post('leads/:id/archive')
  archiveLead(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.leadsService.archiveLead(id);
  }

  @Post('leads/:id/price')
  appendPriceHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AppendPriceHistoryDto,
  ) {
    return this.leadsService.appendPriceHistory(id, dto);
  }

  @Get('leads')
  listLeads(@Query() query: ListLeadsDto) {
    return this.leadsService.listLeads(query);
  }

  @Get('metrics')
  getAdminMetrics() {
    return this.leadsService.getAdminMetrics();
  }

  @Get('metrics/extended')
  getAdminMetricsExtended() {
    return this.leadsService.getAdminMetricsExtended();
  }

  @Get('refund-requests')
  listRefundRequests() {
    return this.refundRequestsService.listAllAdmin();
  }

  @Patch('refund-requests/:id')
  resolveRefundRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminResolveRefundDto,
  ) {
    return this.refundRequestsService.resolveAdmin(
      id,
      dto.status,
      dto.admin_notes,
      dto.resolution,
    );
  }

  @Get('lead-duplicate-groups')
  listDuplicateLeadGroups() {
    return this.leadsService.listDuplicatePhoneGroups();
  }

  @Post('leads/:duplicateId/mark-duplicate')
  markLeadDuplicate(
    @Param('duplicateId', new ParseUUIDPipe()) duplicateId: string,
    @Body() body: MarkDuplicateLeadDto,
  ) {
    return this.leadsService.markLeadAsDuplicateOf(body.canonical_lead_id, duplicateId);
  }
}
