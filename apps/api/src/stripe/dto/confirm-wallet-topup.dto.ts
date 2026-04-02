import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConfirmWalletTopupDto {
  @IsString()
  @IsNotEmpty()
  paymentIntentId!: string;

  /** Persist the card used on this PaymentIntent for wallet auto-reload (server reads PM from Stripe). */
  @IsOptional()
  @IsBoolean()
  savePaymentMethodForAutoReload?: boolean;
}
