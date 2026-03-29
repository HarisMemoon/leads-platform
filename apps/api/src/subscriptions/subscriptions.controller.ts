import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { SubscriptionsService } from './subscriptions.service';

@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  plans() {
    return this.subscriptionsService.getPlanCatalog();
  }

  @Post('checkout')
  checkout(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    return this.subscriptionsService.checkout(req.user.userId, dto.planType);
  }

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.subscriptionsService.getMine(req.user.userId);
  }

  @Post('cancel')
  cancel(@Req() req: { user: { userId: string } }) {
    return this.subscriptionsService.cancel(req.user.userId);
  }
}

