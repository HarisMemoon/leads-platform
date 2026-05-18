import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { InboundService } from './inbound.service';
import { InboundLeadDto } from './dto/inbound-lead.dto';

class BatchInboundLeadsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InboundLeadDto)
  leads!: InboundLeadDto[];
}

@Controller('inbound')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Post('lead')
  @HttpCode(HttpStatus.CREATED)
  async receiveLead(
    @Headers('x-vendor-key') apiKey: string | undefined,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    dto: InboundLeadDto,
    @Ip() ip: string,
  ) {
    if (!apiKey) {
      throw new UnauthorizedException('Missing X-Vendor-Key header');
    }

    const rawPayload = { ...dto } as Record<string, unknown>;
    const vendor = await this.inboundService.authenticateVendor(apiKey);

    try {
      const lead = await this.inboundService.createLead(vendor, dto, ip, rawPayload);
      return {
        success: true,
        lead_id: lead.id,
        market: lead.market,
        lead_type: lead.lead_type,
        status: lead.status,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await this.inboundService.logRejection(vendor.id, msg, ip, rawPayload);
      throw err;
    }
  }

  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  async receiveLeadBatch(
    @Headers('x-vendor-key') apiKey: string | undefined,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    dto: BatchInboundLeadsDto,
    @Ip() ip: string,
  ) {
    if (!apiKey) {
      throw new UnauthorizedException('Missing X-Vendor-Key header');
    }

    const vendor = await this.inboundService.authenticateVendor(apiKey);

    const results: Array<{ index: number; success: boolean; lead_id?: string; error?: string }> = [];
    let accepted = 0;
    let rejected = 0;

    for (let i = 0; i < dto.leads.length; i++) {
      const item = dto.leads[i];
      const rawPayload = { ...item } as Record<string, unknown>;
      try {
        const lead = await this.inboundService.createLead(vendor, item, ip, rawPayload);
        results.push({ index: i, success: true, lead_id: lead.id });
        accepted++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await this.inboundService.logRejection(vendor.id, msg, ip, rawPayload);
        results.push({ index: i, success: false, error: msg });
        rejected++;
      }
    }

    return { total: dto.leads.length, accepted, rejected, results };
  }
}
