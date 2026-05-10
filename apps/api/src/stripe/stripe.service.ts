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
    const webhookSecret = (configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '').trim();

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }

    this.stripe = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
    if (!webhookSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET is empty — API starts, but /stripe/webhook will reject until you set it. Wallet top-ups still need Stripe to deliver payment_intent.succeeded (use Stripe CLI forward locally).',
      );
    }
    this.appBaseUrl =
      configService.get<string>('APP_BASE_URL')?.replace(/\/$/, '') ??
      'http://localhost:3000';
  }

  async createPaymentIntent(
    userId: string,
    amountCents: number,
    options?: { saveForFutureUse?: boolean },
  ) {
    const stripeCustomerId = await this.ensureStripeCustomerId(userId);
    const saveForFutureUse = options?.saveForFutureUse === true;

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      /** Card only — avoids Stripe Link / other APMs bundled with `automatic_payment_methods`. */
      payment_method_types: ['card'],
      ...(saveForFutureUse ? { setup_future_usage: 'off_session' as const } : {}),
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

  /**
   * Off-session charge for wallet auto-reload (cron). Credits the wallet as soon as Stripe
   * returns `succeeded`, same as the normal top-up path — webhooks alone are not enough when
   * `payment_intent.succeeded` is delayed or not configured locally.
   */
  async chargeWalletAutoReload(
    userId: string,
    amountCents: number,
    paymentMethodId: string,
    stripeCustomerId?: string | null,
    opts?: { balanceCentsForIdempotency?: string },
  ): Promise<Stripe.PaymentIntent> {
    const customerId =
      stripeCustomerId ?? (await this.ensureStripeCustomerId(userId));

    const balanceHint = opts?.balanceCentsForIdempotency ?? '0';
    const cronBucket = Math.floor(Date.now() / 120_000);
    const idempotencyKey = `wallet-ar:${userId}:${balanceHint}:${cronBucket}`;

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        confirm: true,
        off_session: true,
        payment_method: paymentMethodId,
        customer: customerId,
        /** Match wallet top-up intents — card-only avoids Link / other APMs breaking off-session. */
        payment_method_types: ['card'],
        metadata: {
          userId,
          amountCents: String(amountCents),
          purpose: 'wallet_auto_reload',
        },
      },
      { idempotencyKey },
    );

    if (intent.status === 'succeeded') {
      await this.walletService.applyStripeTopUp(
        userId,
        amountCents,
        intent.id,
        'Wallet auto-reload',
      );
      return intent;
    }

    if (intent.status === 'processing') {
      this.logger.log(
        `Auto-reload PaymentIntent ${intent.id} processing; wallet will credit via webhook when confirmed.`,
      );
      return intent;
    }

    const detail =
      intent.last_payment_error?.message ??
      intent.last_payment_error?.code ??
      `status=${intent.status}`;
    this.logger.error(
      `Auto-reload PaymentIntent ${intent.id} did not succeed: ${detail}`,
    );
    throw new Error(
      `Auto-reload payment did not succeed (${intent.status}): ${detail}`,
    );
  }

  /** Event types must stay in sync with `STRIPE_WEBHOOK_EVENT_TYPES` in stripe-webhook-events.ts. */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.webhookSecret) {
      throw new BadRequestException(
        'Stripe webhooks are not configured. Set STRIPE_WEBHOOK_SECRET in apps/api/.env',
      );
    }
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

    if (event.type === 'invoice.paid') {
      await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
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

  async syncSubscriptionFromCheckoutSession(
    userId: string,
    sessionId: string,
  ): Promise<Subscription> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.mode !== 'subscription') {
      throw new BadRequestException('Checkout session is not for a subscription');
    }

    const sessionUserId =
      session.client_reference_id ?? session.metadata?.userId ?? null;
    if (sessionUserId && sessionUserId !== userId) {
      throw new BadRequestException('Checkout session does not belong to this user');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const sessionCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;
    if (
      sessionCustomerId &&
      user.stripe_customer_id &&
      sessionCustomerId !== user.stripe_customer_id
    ) {
      throw new BadRequestException('Checkout session customer mismatch');
    }

    if (sessionCustomerId && !user.stripe_customer_id) {
      user.stripe_customer_id = sessionCustomerId;
      await this.userRepo.save(user);
    }

    const subscription =
      typeof session.subscription === 'string'
        ? await this.stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
    if (!subscription) {
      throw new BadRequestException('Checkout session has no subscription');
    }

    return this.upsertSubscriptionFromStripe(subscription);
  }

  async syncLatestSubscriptionForUser(
    userId: string,
  ): Promise<Subscription | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.stripe_customer_id) {
      return null;
    }

    const subscriptions = await this.stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'all',
      limit: 10,
    });
    const activeLike = subscriptions.data
      .filter((sub) =>
        ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status),
      )
      .sort((a, b) => b.created - a.created)[0];

    if (!activeLike) {
      return null;
    }

    return this.upsertSubscriptionFromStripe(activeLike);
  }

  async savePaymentMethod(userId: string, paymentMethodId: string) {
    const stripeCustomerId = await this.ensureStripeCustomerId(userId);

    try {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (
        !msg.includes('already been attached') &&
        !msg.includes('already attached')
      ) {
        throw err;
      }
    }

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

  /**
   * Masked card details for wallet UI (brand + last4 + expiry). Never exposes full PAN.
   */
  async getPaymentMethodPreview(userId: string): Promise<{
    paymentMethod: {
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    } | null;
  }> {
    const wallet = await this.walletRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet?.stripe_payment_method_id) {
      return { paymentMethod: null };
    }
    try {
      const pm = await this.stripe.paymentMethods.retrieve(
        wallet.stripe_payment_method_id,
      );
      if (pm.type === 'card' && pm.card) {
        return {
          paymentMethod: {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          },
        };
      }
    } catch (e: unknown) {
      this.logger.warn(
        `Payment method preview failed: ${e instanceof Error ? e.message : e}`,
      );
    }
    return { paymentMethod: null };
  }

  /**
   * After a succeeded wallet top-up, store the PaymentMethod used on the intent for off-session charges.
   * Expects the PaymentIntent to have been created with a Stripe Customer (see createPaymentIntent).
   */
  private async persistPaymentMethodFromSucceededIntent(
    userId: string,
    intent: Stripe.PaymentIntent,
  ): Promise<void> {
    const rawPm = intent.payment_method;
    if (!rawPm) {
      throw new BadRequestException(
        'No payment method on this payment. Try again with a card payment.',
      );
    }
    const paymentMethodId =
      typeof rawPm === 'string' ? rawPm : rawPm.id;

    const stripeCustomerId = await this.ensureStripeCustomerId(userId);
    const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId);

    if (!pm.customer) {
      try {
        await this.stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (
          !msg.includes('already been attached') &&
          !msg.includes('already attached')
        ) {
          throw err;
        }
      }
    } else if (pm.customer !== stripeCustomerId) {
      throw new BadRequestException(
        'Payment method is associated with a different account.',
      );
    }

    await this.stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const wallet = await this.walletRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    wallet.stripe_payment_method_id = paymentMethodId;
    wallet.auto_reload_opt_in = true;
    await this.walletRepo.save(wallet);
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

    await this.walletService.applyStripeTopUp(
      userId,
      Math.floor(amountCents),
      intent.id,
      'Stripe top-up',
    );
  }

  /**
   * Called right after Stripe.js confirms payment so the wallet updates without waiting for webhooks.
   * Optionally persists the card from the PaymentIntent for auto-reload (no client-side PM id needed).
   */
  async confirmWalletTopUp(
    userId: string,
    paymentIntentId: string,
    options?: { savePaymentMethodForAutoReload?: boolean },
  ) {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method'],
    });

    if (intent.status !== 'succeeded') {
      throw new BadRequestException('Payment is not completed');
    }

    const metaUserId = intent.metadata?.userId;
    if (!metaUserId || metaUserId !== userId) {
      throw new BadRequestException('Payment does not belong to this account');
    }

    const amountCents = Number(intent.metadata?.amountCents ?? intent.amount_received);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }

    await this.walletService.applyStripeTopUp(
      userId,
      Math.floor(amountCents),
      intent.id,
      'Stripe top-up',
    );

    if (options?.savePaymentMethodForAutoReload) {
      await this.persistPaymentMethodFromSucceededIntent(userId, intent);
    }

    return this.walletService.getWallet(userId);
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

  /**
   * Marketplace v2: monthly wallet credits are removed. Pro is an entitlement
   * plan (10% discount, early access, priority notifications) — no wallet top-up.
   * This handler is kept as a no-op stub so the webhook pipeline stays intact.
   */
  private async handleInvoicePaid(_invoice: Stripe.Invoice) {
    // No-op: monthly wallet credits removed in marketplace v2.
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
    // Marketplace v2: priority_weight and monthly_lead_limit are no longer used
    // for runtime eligibility — distribution is rule-based only. Kept for
    // backwards compatibility with existing subscription rows.
    const map: Record<PlanType, { priorityWeight: number; monthlyLeadLimit: number | null }> = {
      [PlanType.BASIC]: { priorityWeight: 1, monthlyLeadLimit: null },
      [PlanType.PRO]: { priorityWeight: 1, monthlyLeadLimit: null },
      [PlanType.MARKET_SPECIFIC]: { priorityWeight: 1, monthlyLeadLimit: null },
      [PlanType.PREMIUM]: { priorityWeight: 1, monthlyLeadLimit: null },
    };

    return map[planType];
  }
}

