import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { IntegrationsService } from './integrations.service';
import { Request } from 'express';
import { IsOptional, IsString } from 'class-validator';

class SetWebhookDto {
  @IsOptional()
  @IsString()
  webhook_url?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUYER)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('webhook')
  getWebhook(@Req() req: Request & { user: { userId: string } }) {
    return this.integrationsService.getWebhookIntegration(req.user.userId);
  }

  @Patch('webhook')
  setWebhook(
    @Req() req: Request & { user: { userId: string } },
    @Body() body: SetWebhookDto,
  ) {
    return this.integrationsService.setWebhookUrl(req.user.userId, body.webhook_url ?? '');
  }

  @Post('webhook/test')
  testWebhook(@Req() req: Request & { user: { userId: string } }) {
    return this.integrationsService.testWebhook(req.user.userId);
  }
}
