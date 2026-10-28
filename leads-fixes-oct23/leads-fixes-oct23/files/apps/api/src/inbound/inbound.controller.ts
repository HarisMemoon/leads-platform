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
    @Headers('x-vendor-api-key') apiKey: string | undefined,
    @Headers('x-vendor-key') legacyApiKey: string | undefined,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    dto: InboundLeadDto,
    @Ip() ip: string,
  ) {
    // x-vendor-api-key is the standard vendor auth header on ALL vendor
    // endpoints (inbound + ping/post/direct). The legacy x-vendor-key header
    // is still accepted here so already-integrated vendors don't break.
    const vendorApiKey = apiKey ?? legacyApiKey;
    if (!vendorApiKey) {
      throw new UnauthorizedException('Missing X-Vendor-Api-Key header');
    }

    const rawPayload = { ...dto } as Record<string, unknown>;
    const vendor = await this.inboundService.authenticateVendor(vendorApiKey);

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

  /**
   * Batch ingestion is a THIN WRAPPER over the single-lead endpoint:
   * each item runs through the exact same createLead pipeline (validation,
   * duplicate check, pricing, distribution, outbound ping) one at a time,
   * in order. There is NO batch-level atomicity — a batch can partially
   * succeed, and the per-item results array reports each lead's outcome
   * (including per-item `duplicate_lead` rejections).
   */
  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  async receiveLeadBatch(
    @Headers('x-vendor-api-key') apiKey: string | undefined,
    @Headers('x-vendor-key') legacyApiKey: string | undefined,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    dto: BatchInboundLeadsDto,
    @Ip() ip: string,
  ) {
    const vendorApiKey = apiKey ?? legacyApiKey;
    if (!vendorApiKey) {
      throw new UnauthorizedException('Missing X-Vendor-Api-Key header');
    }

    const vendor = await this.inboundService.authenticateVendor(vendorApiKey);

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
