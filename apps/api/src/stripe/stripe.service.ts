import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { WalletAccount } from '../entities/wallet-account.entity';
import { WalletService } from '../wallet/wallet.service';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { PlanType } from '../../common/enums/plan-type.enum';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly appBaseUrl: string;

  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WalletAccount)
    private readonly walletRepo: Repository<WalletAccount>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly walletService: WalletService,
  ) {
    const secretKey = configService.get<string>('STRIPE_SECRET_KEY');
    const webhookSecret = configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
    }

    this.stripe = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
    this.appBaseUrl =
      configService.get<string>('APP_BASE_URL')?.replace(/\/$/, '') ??
      'http://localhost:3000';
  }

  async createPaymentIntent(userId: string, amountCents: number) {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId,
        amountCents: String(amountCents),
      },
    });

    if (!paymentIntent.client_secret) {
      throw new BadRequestException('Unable to create payment intent');
    }

    return { clientSecret: paymentIntent.client_secret };
  }

  async createOffSessionPaymentIntent(
    userId: string,
    amountCents: number,
    paymentMethodId: string,
    stripeCustomerId?: string | null,
  ) {
    return this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      confirm: true,
      off_session: true,
      payment_method: paymentMethodId,
      customer: stripeCustomerId ?? undefined,
      metadata: {
        userId,
        amountCents: String(amountCents),
      },
    });
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );

    if (event.type === 'payment_intent.succeeded') {
      await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      this.logger.warn(
        `Payment intent failed: ${intent.id} (${intent.last_payment_error?.message ?? 'unknown error'})`,
      );
    }

    if (event.type === 'customer.subscription.updated') {
      await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    }

    if (event.type === 'customer.subscription.created') {
      await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
    }

    if (event.type === 'customer.subscription.deleted') {
      await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    }

    if (event.type === 'invoice.payment_failed') {
      await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    }

    return { received: true };
  }

  /**
   * Ensures the user has a Stripe Customer and returns its id (creates + persists if missing).
   * Required for subscriptions and for attaching saved payment methods.
   */
  async ensureStripeCustomerId(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.full_name ?? undefined,
      metadata: { userId: user.id },
    });
    user.stripe_customer_id = customer.id;
    await this.userRepo.save(user);
    return customer.id;
  }

  async savePaymentMethod(userId: string, paymentMethodId: string) {
    const stripeCustomerId = await this.ensureStripeCustomerId(userId);

    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    await this.stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const wallet = await this.walletRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    wallet.stripe_payment_method_id = paymentMethodId;
    await this.walletRepo.save(wallet);

    return { success: true };
  }

  async createCustomerPortal(userId: string) {
    const stripeCustomerId = await this.ensureStripeCustomerId(userId);
    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${this.appBaseUrl}/subscriptions`,
    });

    if (!session.url) {
      throw new BadRequestException('Unable to create customer portal session');
    }

    return { url: session.url };
  }

  private async handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
    const userId = intent.metadata?.userId;
    const amountCents = Number(intent.metadata?.amountCents ?? intent.amount_received);

    if (!userId || !Number.isFinite(amountCents) || amountCents <= 0) {
      this.logger.warn(
        `Skipping wallet top-up due to missing metadata for intent ${intent.id}`,
      );
      return;
    }

    await this.walletService.topUp(
      userId,
      Math.floor(amountCents),
      'Stripe top-up',
      'stripe_topup',
    );
  }

  private async handleSubscriptionCreated(stripeSub: Stripe.Subscription) {
    await this.upsertSubscriptionFromStripe(stripeSub);
  }

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    const localSub = await this.upsertSubscriptionFromStripe(stripeSub);

    const { periodStart, periodEnd } =
      this.extractPeriodBoundsFromSubscription(stripeSub);
    const previousEnd = localSub.current_period_end;
    localSub.status = this.mapStripeSubscriptionStatus(stripeSub.status);
    localSub.current_period_start = periodStart;
    localSub.current_period_end = periodEnd;

    if (
      previousEnd &&
      localSub.current_period_start &&
      localSub.current_period_start.getTime() >= previousEnd.getTime()
    ) {
      localSub.leads_used_this_period = 0;
    }

    await this.subscriptionRepo.save(localSub);
  }

  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const localSub = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: stripeSub.id },
    });
    if (!localSub) return;

    localSub.status = SubscriptionStatus.CANCELLED;
    await this.subscriptionRepo.save(localSub);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subId = this.extractSubscriptionIdFromInvoice(invoice);
    if (!subId) {
      return;
    }

    const localSub = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: subId },
    });
    if (!localSub) return;

    localSub.status = SubscriptionStatus.PAST_DUE;
    await this.subscriptionRepo.save(localSub);
  }

  private async upsertSubscriptionFromStripe(stripeSub: Stripe.Subscription) {
    const customerId =
      typeof stripeSub.customer === 'string'
        ? stripeSub.customer
        : stripeSub.customer?.id;
    if (!customerId) {
      throw new BadRequestException('Stripe subscription is missing a customer id');
    }

    const user = await this.userRepo.findOne({
      where: { stripe_customer_id: customerId },
    });
    if (!user) {
      throw new NotFoundException('User not found for Stripe customer');
    }

    const priceId =
      stripeSub.items.data[0]?.price?.id ??
      (() => {
        throw new BadRequestException('Stripe subscription is missing a price');
      })();
    const planType = this.mapPriceIdToPlan(priceId);
    const { priorityWeight, monthlyLeadLimit } =
      this.planDefaults(planType);
    const { periodStart, periodEnd } =
      this.extractPeriodBoundsFromSubscription(stripeSub);

    let localSub = await this.subscriptionRepo.findOne({
      where: { stripe_subscription_id: stripeSub.id },
    });

    if (!localSub) {
      localSub = this.subscriptionRepo.create({
        user,
        stripe_subscription_id: stripeSub.id,
        stripe_price_id: priceId,
        plan_type: planType,
        status: this.mapStripeSubscriptionStatus(stripeSub.status),
        priority_weight: priorityWeight,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        monthly_lead_limit: monthlyLeadLimit,
        markets: [],
      });
      return this.subscriptionRepo.save(localSub);
    }

    localSub.stripe_price_id = priceId;
    localSub.plan_type = planType;
    localSub.status = this.mapStripeSubscriptionStatus(stripeSub.status);
    localSub.priority_weight = priorityWeight;
    localSub.current_period_start = periodStart;
    localSub.current_period_end = periodEnd;
    localSub.monthly_lead_limit = monthlyLeadLimit;
    return this.subscriptionRepo.save(localSub);
  }

  private mapStripeSubscriptionStatus(
    status: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    if (status === 'active' || status === 'trialing') {
      return SubscriptionStatus.ACTIVE;
    }
    if (status === 'past_due' || status === 'unpaid') {
      return SubscriptionStatus.PAST_DUE;
    }
    if (status === 'canceled' || status === 'incomplete_expired') {
      return SubscriptionStatus.CANCELLED;
    }
    return SubscriptionStatus.PAUSED;
  }

  private extractPeriodBoundsFromSubscription(stripeSub: Stripe.Subscription) {
    const sub = stripeSub as Stripe.Subscription & {
      current_period_start?: number;
      current_period_end?: number;
      items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
    };

    const startUnix =
      sub.current_period_start ??
      sub.items?.data?.[0]?.current_period_start ??
      Math.floor(Date.now() / 1000);
    const endUnix =
      sub.current_period_end ??
      sub.items?.data?.[0]?.current_period_end ??
      startUnix + 30 * 24 * 60 * 60;

    return {
      periodStart: new Date(startUnix * 1000),
      periodEnd: new Date(endUnix * 1000),
    };
  }

  private extractSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const inv = invoice as Stripe.Invoice & {
      subscription?: string | { id: string };
      parent?: {
        subscription_details?: {
          subscription?: string;
        };
      };
    };

    const direct =
      typeof inv.subscription === 'string'
        ? inv.subscription
        : inv.subscription?.id;
    if (direct) return direct;

    return inv.parent?.subscription_details?.subscription ?? null;
  }

  private mapPriceIdToPlan(priceId: string): PlanType {
    const priceMap: Record<string, PlanType> = {
      [process.env.STRIPE_PRICE_ID_BASIC ?? '']: PlanType.BASIC,
      [process.env.STRIPE_PRICE_ID_PRO ?? '']: PlanType.PRO,
      [process.env.STRIPE_PRICE_ID_MARKET_SPECIFIC ?? '']: PlanType.MARKET_SPECIFIC,
      [process.env.STRIPE_PRICE_ID_PREMIUM ?? '']: PlanType.PREMIUM,
    };

    const planType = priceMap[priceId];
    if (!planType) {
      throw new BadRequestException(`Unknown Stripe price id: ${priceId}`);
    }

    return planType;
  }

  private planDefaults(planType: PlanType) {
    const map: Record<PlanType, { priorityWeight: number; monthlyLeadLimit: number | null }> = {
      [PlanType.BASIC]: { priorityWeight: 1, monthlyLeadLimit: 10 },
      [PlanType.PRO]: { priorityWeight: 2, monthlyLeadLimit: 30 },
      [PlanType.MARKET_SPECIFIC]: { priorityWeight: 3, monthlyLeadLimit: null },
      [PlanType.PREMIUM]: { priorityWeight: 4, monthlyLeadLimit: null },
    };

    return map[planType];
  }
}

