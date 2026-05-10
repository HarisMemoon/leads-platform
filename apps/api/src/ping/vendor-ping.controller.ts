import { Body, Controller, Headers, Post } from '@nestjs/common';

import { VendorPingDto } from './dto/vendor-ping.dto';
import { VendorPostDto } from './dto/vendor-post.dto';
import { PingService } from './ping.service';

@Controller('vendor')
export class VendorPingController {
  constructor(private readonly pingService: PingService) {}

  @Post('ping')
  ping(
    @Headers('x-vendor-api-key') apiKey: string | undefined,
    @Body() dto: VendorPingDto,
  ) {
    return this.pingService.receivePing(apiKey, dto);
  }

  @Post('post')
  post(
    @Headers('x-vendor-api-key') apiKey: string | undefined,
    @Body() dto: VendorPostDto,
  ) {
    return this.pingService.receivePost(apiKey, dto);
  }
}
