import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { In, Repository } from 'typeorm';
import { PlanType } from '../../common/enums/plan-type.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { SubscriptionPlanCatalogItemDto } from './dto/subscription-plan-catalog.dto';
import { Subscription } from '../entities/subscription.entity';
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
   */
  getPlanCatalog(): SubscriptionPlanCatalogItemDto[] {
    const base = this.planCatalogDefinitions();
    return base.map((row) => ({
      ...row,
      stripeConfigured: !!this.stripePriceIdFor(row.planType),
    }));
  }

  async checkout(
    userId: string,
    planType: PlanType,
  ): Promise<SubscriptionCheckoutResult> {
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
      success_url: `${this.appBaseUrl}/subscriptions?checkout=success`,
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
    return this.subscriptionRepo.findOne({
      where: { user: { id: userId } },
      order: { updated_at: 'DESC' },
    });
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
        tagline: 'Start with steady lead flow and standard rotation priority.',
        displayPrice: '$49',
        billingPeriodLabel: 'per month',
        monthlyLeadLimit: 10,
        leadLimitSummary: 'Up to 10 leads / billing period',
        priorityRank: 1,
        priorityLabel: 'Standard merry-go-round priority',
        distributionSummary:
          'Included in rotation after higher-tier subscribers in each market.',
        includedLeadCreditsSummary: '10 lead credits / month toward distribution',
        filterScope: {
          state: true,
          county: false,
          zip: false,
          leadType: true,
        },
        cardHighlights: [
          '10 leads / month',
          'State + lead-type filters',
          'Stripe recurring billing',
        ],
        featureBullets: [
          'Recurring billing through Stripe (cancel anytime from billing portal)',
          'Up to 10 included lead credits per monthly period',
          'Merry-go-round priority: standard (tier 1 of 4)',
          'Filters: US state and lead type (motivated seller, probate, etc.)',
          'County and ZIP filters unlock on higher plans',
        ],
      },
      {
        planType: PlanType.PRO,
        name: 'Pro',
        tagline: 'More volume, higher rotation priority, and county-level targeting.',
        displayPrice: '$129',
        billingPeriodLabel: 'per month',
        monthlyLeadLimit: 30,
        leadLimitSummary: 'Up to 30 leads / billing period',
        priorityRank: 2,
        priorityLabel: 'Elevated merry-go-round priority',
        distributionSummary:
          'Ahead of Basic in the rotation when leads match your filters.',
        includedLeadCreditsSummary: '30 lead credits / month toward distribution',
        filterScope: {
          state: true,
          county: true,
          zip: false,
          leadType: true,
        },
        cardHighlights: [
          '30 leads / month',
          'State, county + lead-type filters',
          'Higher rotation priority',
        ],
        featureBullets: [
          'Recurring billing through Stripe',
          'Up to 30 included lead credits per monthly period',
          'Merry-go-round priority: elevated (tier 2 of 4)',
          'Filters: state, county, and lead type',
          'ZIP-level targeting available on Market-Specific and Premium',
        ],
      },
      {
        planType: PlanType.MARKET_SPECIFIC,
        name: 'Market-Specific',
        tagline: 'Unlimited leads in one chosen market with top-tier local priority.',
        displayPrice: '$249',
        billingPeriodLabel: 'per month',
        monthlyLeadLimit: null,
        leadLimitSummary: 'Unlimited leads within your selected market',
        priorityRank: 3,
        priorityLabel: 'High priority in your market',
        distributionSummary:
          'Highest priority for matching leads inside the market you lock in.',
        includedLeadCreditsSummary:
          'Unlimited distribution-eligible leads within 1 market',
        filterScope: {
          state: true,
          county: true,
          zip: true,
          leadType: true,
        },
        cardHighlights: [
          'Unlimited in 1 market',
          'Full geo + lead-type filters',
          'High rotation priority',
        ],
        featureBullets: [
          'Recurring billing through Stripe',
          'Unlimited lead flow within a single designated market',
          'Merry-go-round priority: high (tier 3 of 4)',
          'Filters: state, county, ZIP, and lead type within that market',
          'Ideal when you dominate one metro or territory',
        ],
      },
      {
        planType: PlanType.PREMIUM,
        name: 'Premium / Exclusive',
        tagline: 'Unlimited everywhere, exclusive inventory access, and maximum priority.',
        displayPrice: '$499',
        billingPeriodLabel: 'per month',
        monthlyLeadLimit: null,
        leadLimitSummary: 'Unlimited leads across all markets',
        priorityRank: 4,
        priorityLabel: 'Maximum merry-go-round priority',
        distributionSummary:
          'First in line for matching leads platform-wide, including exclusive listings.',
        includedLeadCreditsSummary:
          'Unlimited credits + exclusive / premium lead access where available',
        filterScope: {
          state: true,
          county: true,
          zip: true,
          leadType: true,
        },
        cardHighlights: [
          'Unlimited all markets',
          'Exclusive lead access',
          'Top rotation priority',
        ],
        featureBullets: [
          'Recurring billing through Stripe',
          'Unlimited lead allocation across every market we serve',
          'Merry-go-round priority: maximum (tier 4 of 4)',
          'Full filters: state, county, ZIP, and lead type everywhere',
          'Premium / exclusive inventory when offered by the platform',
        ],
      },
    ];
  }
}

