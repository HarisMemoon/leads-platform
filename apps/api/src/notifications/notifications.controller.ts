import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { NotificationsService } from './notifications.service';
import { Request } from 'express';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  listMine(@Req() req: Request & { user: { userId: string } }) {
    return this.notificationsService.listForUser(req.user.userId);
  }
}
