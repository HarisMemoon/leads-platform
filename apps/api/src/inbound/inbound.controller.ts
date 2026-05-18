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
import { InboundService } from './inbound.service';
import { InboundLeadDto } from './dto/inbound-lead.dto';

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
    const lead = await this.inboundService.createLead(vendor, dto, ip, rawPayload);

    return {
      success: true,
      lead_id: lead.id,
      market: lead.market,
      lead_type: lead.lead_type,
      status: lead.status,
    };
  }
}
