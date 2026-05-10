import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../../common/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateVendorIntegrationDto,
  PatchVendorIntegrationDto,
} from './dto/admin-vendor-integration.dto';
import { PingService } from './ping.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class PingAdminController {
  constructor(private readonly pingService: PingService) {}

  @Get('vendors')
  listVendors() {
    return this.pingService.listVendors();
  }

  @Post('vendors')
  createVendor(@Body() dto: CreateVendorIntegrationDto) {
    return this.pingService.createVendor(dto);
  }

  @Patch('vendors/:id')
  patchVendor(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PatchVendorIntegrationDto,
  ) {
    return this.pingService.patchVendor(id, dto);
  }

  @Get('pings')
  listPings(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.pingService.listPings(limit);
  }

  @Get('pings/:id')
  getPing(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pingService.getPing(id);
  }
}
