import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { ConfirmWalletTopupDto } from './dto/confirm-wallet-topup.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('payment-method-preview')
  getPaymentMethodPreview(
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.stripeService.getPaymentMethodPreview(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-payment-intent')
  createPaymentIntent(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: CreatePaymentIntentDto,
    @Query('save_card') saveCard?: string,
  ) {
    const saveForFutureUse =
      saveCard === '1' || saveCard === 'true' || saveCard === 'yes';
    return this.stripeService.createPaymentIntent(req.user.userId, dto.amountCents, {
      saveForFutureUse,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm-wallet-topup')
  confirmWalletTopUp(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: ConfirmWalletTopupDto,
  ) {
    return this.stripeService.confirmWalletTopUp(
      req.user.userId,
      dto.paymentIntentId,
      {
        savePaymentMethodForAutoReload:
          dto.savePaymentMethodForAutoReload === true,
      },
    );
  }

  @Post('webhook')
  webhook(
    @Req() req: Request & { body: Buffer; rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.stripeService.handleWebhook(req.rawBody ?? req.body, signature);
  }

  @UseGuards(JwtAuthGuard)
  @Post('save-payment-method')
  savePaymentMethod(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: SavePaymentMethodDto,
  ) {
    return this.stripeService.savePaymentMethod(req.user.userId, dto.paymentMethodId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('customer-portal')
  customerPortal(@Req() req: Request & { user: { userId: string } }) {
    return this.stripeService.createCustomerPortal(req.user.userId);
  }
}

