import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { In, Repository } from 'typeorm';
import { PlanType } from '../../common/enums/plan-type.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { visibleFeatureBulletTexts } from '../../common/subscription-plan-bullet.util';
import { SubscriptionPlanCatalogItemDto } from './dto/subscription-plan-catalog.dto';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { User } from '../entities/user.entity';
import { StripeService } from '../stripe/stripe.service';

export type SubscriptionCheckoutResult = {
  url: string;
};

@Injectable()
export class SubscriptionsService {
  private readonly stripe: Stripe;
  private readonly appBaseUrl: string;

  constructor(
    configService: ConfigService,
    private readonly stripeService: StripeService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
  ) {
    const secretKey = configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    this.stripe = new Stripe(secretKey);
    this.appBaseUrl =
      configService.get<string>('APP_BASE_URL')?.replace(/\/$/, '') ??
      'http://localhost:3000';
  }

  /**
   * Marketplace catalog for the web app: limits, filters, priority, and whether Stripe checkout is wired.
   * Reads from the subscription_plans DB table (admin-editable). Falls back to hardcoded
   * definitions if the table is empty (early bootstrap before migrations seed it).
   */
  async getPlanCatalog(): Promise<SubscriptionPlanCatalogItemDto[]> {
    // Marketplace v2: only the Pro plan is publicly visible. Basic is hidden.
    const rows = await this.planRepo.find({
      where: {
        is_active: true,
        plan_type: PlanType.PRO,
      },
      order: { priority_rank: 'ASC' },
    });
    if (rows.length === 0) {
      return this.planCatalogDefinitions()
        .filter((row) => row.planType === PlanType.PRO)
        .map((row) => ({
          ...row,
          stripeConfigured: !!this.stripePriceIdFor(row.planType),
        }));
    }
    return rows.map((row) => ({
      planType: row.plan_type,
      name: row.name,
      tagline: row.tagline,
      displayPrice: row.display_price,
      billingPeriodLabel: row.billing_period_label,
      monthlyLeadLimit: row.monthly_lead_limit,
      leadLimitSummary: row.lead_limit_summary,
      priorityRank: row.priority_rank,
      priorityLabel: row.priority_label,
      distributionSummary: row.distribution_summary,
      includedLeadCreditsSummary: row.included_lead_credits_summary,
      filterScope: {
        state: !!row.filter_scope?.state,
        county: !!row.filter_scope?.county,
        zip: !!row.filter_scope?.zip,
        leadType: !!row.filter_scope?.leadType,
      },
      cardHighlights: row.card_highlights ?? [],
      featureBullets: visibleFeatureBulletTexts(row.feature_bullets),
      stripeConfigured: !!this.stripePriceIdFor(row.plan_type),
    }));
  }

  async checkout(
    userId: string,
    planType: PlanType,
  ): Promise<SubscriptionCheckoutResult> {
    // Marketplace v2: only Pro checkout is available.
    if (planType !== PlanType.PRO) {
      throw new BadRequestException('Only the Pro plan is available for subscription');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const blocking = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
        ]),
      },
      order: { updated_at: 'DESC' },
    });
    if (blocking) {
      throw new BadRequestException(
        'You already have a subscription. Cancel it before choosing a new plan.',
      );
    }

    await this.stripeService.ensureStripeCustomerId(userId);
    const userWithCustomer = await this.userRepo.findOne({
      where: { id: userId },
    });
    if (!userWithCustomer?.stripe_customer_id) {
      throw new BadRequestException('Unable to resolve Stripe customer');
    }

    const { priceId } = this.mapPlanToStripePrice(planType);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: userWithCustomer.stripe_customer_id,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.appBaseUrl}/subscriptions?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.appBaseUrl}/subscriptions?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        userId,
        planType,
      },
      subscription_data: {
        metadata: {
          userId,
          planType,
        },
      },
    });

    if (!session.url) {
      throw new BadRequestException('Unable to create Stripe checkout session');
    }

    return { url: session.url };
  }

  async getMine(userId: string) {
    const activeLike = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
        ]),
      },
      order: { updated_at: 'DESC' },
    });
    if (activeLike) {
      return activeLike;
    }
    await this.stripeService.syncLatestSubscriptionForUser(userId);
    const reconciledActiveLike = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
        ]),
      },
      order: { updated_at: 'DESC' },
    });
    if (reconciledActiveLike) {
      return reconciledActiveLike;
    }
    return this.subscriptionRepo.findOne({
      where: { user: { id: userId } },
      order: { updated_at: 'DESC' },
    });
  }

  async syncCheckoutSession(userId: string, sessionId: string) {
    if (!sessionId?.trim()) {
      throw new BadRequestException('Missing checkout session id');
    }
    await this.stripeService.syncSubscriptionFromCheckoutSession(
      userId,
      sessionId.trim(),
    );
    return this.getMine(userId);
  }

  async cancel(userId: string) {
    const current = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.PAUSED,
        ]),
      },
      order: { updated_at: 'DESC' },
    });

    if (!current) {
      throw new NotFoundException('No subscription to cancel');
    }

    await this.stripe.subscriptions.cancel(current.stripe_subscription_id);
    current.status = SubscriptionStatus.CANCELLED;
    return this.subscriptionRepo.save(current);
  }

  private stripePriceIdFor(planType: PlanType): string {
    const envMap: Record<PlanType, string> = {
      [PlanType.BASIC]: process.env.STRIPE_PRICE_ID_BASIC ?? '',
      [PlanType.PRO]: process.env.STRIPE_PRICE_ID_PRO ?? '',
      [PlanType.MARKET_SPECIFIC]: process.env.STRIPE_PRICE_ID_MARKET_SPECIFIC ?? '',
      [PlanType.PREMIUM]: process.env.STRIPE_PRICE_ID_PREMIUM ?? '',
    };
    return (envMap[planType] ?? '').trim();
  }

  private mapPlanToStripePrice(planType: PlanType) {
    const priceId = this.stripePriceIdFor(planType);
    if (!priceId) {
      throw new BadRequestException(`Stripe price ID not configured for ${planType}`);
    }
    return { priceId };
  }

  private planCatalogDefinitions(): Omit<
    SubscriptionPlanCatalogItemDto,
    'stripeConfigured'
  >[] {
    return [
      {
        planType: PlanType.BASIC,
        name: 'Basic',
        tagline: 'Premium subscription leads plus a monthly wallet allowance.',
        displayPrice: '$199',
        billingPeriodLabel: 'per month',
        monthlyLeadLimit: 25,
        leadLimitSummary: 'Up to 25 premium leads / billing period',
        priorityRank: 1,
        priorityLabel: 'Standard merry-go-round priority',
        distributionSummary:
          'Included in automated distribution when leads match your geography.',
        includedLeadCreditsSummary:
          '25 premium lead credits / month + $50 wallet credit / month',
        filterScope: {
          state: true,
          county: true,
          zip: false,
          leadType: false,
        },
        cardHighlights: [
          '25 premium leads / month',
          '$50 wallet credit / month',
          'Stripe subscription billing',
        ],
        featureBullets: [
          'Recurring billing through Stripe (cancel anytime from billing portal)',
          '25 included premium lead credits per monthly period',
          '$50 wallet credit each billing cycle (posted when Stripe invoices are paid)',
          'Geography-first market selection in onboarding',
        ],
      },
      {
        planType: PlanType.PRO,
        name: 'Pro',
        tagline: 'Higher volume premium leads and a larger monthly wallet allowance.',
        displayPrice: '$349',
        billingPeriodLabel: 'per month',
        monthlyLeadLimit: 40,
        leadLimitSummary: 'Up to 40 premium leads / billing period',
        priorityRank: 2,
        priorityLabel: 'Elevated merry-go-round priority',
        distributionSummary:
          'Ahead of Basic in the rotation when leads match your filters.',
        includedLeadCreditsSummary:
          '40 premium lead credits / month + $100 wallet credit / month',
        filterScope: {
          state: true,
          county: true,
          zip: true,
          leadType: false,
        },
        cardHighlights: [
          '40 premium leads / month',
          '$100 wallet credit / month',
          'Higher rotation priority',
        ],
        featureBullets: [
          'Recurring billing through Stripe',
          '40 included premium lead credits per monthly period',
          '$100 wallet credit each billing cycle (posted when Stripe invoices are paid)',
          'Geography-first market selection in onboarding',
        ],
      },
    ];
  }
}

