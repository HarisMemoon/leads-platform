import { PlanType } from '../../../common/enums/plan-type.enum';

/** Geo / lead-type filter capabilities exposed to the client for the subscription marketplace. */
export class SubscriptionPlanFilterScopeDto {
  state!: boolean;
  county!: boolean;
  zip!: boolean;
  leadType!: boolean;
}

/** One row in the subscription marketplace catalog (GET /subscriptions/plans). */
export class SubscriptionPlanCatalogItemDto {
  planType!: PlanType;
  name!: string;
  tagline!: string;
  /** e.g. "$79" — display only; actual charge is the Stripe Price linked in env. */
  displayPrice!: string;
  billingPeriodLabel!: string;
  monthlyLeadLimit!: number | null;
  leadLimitSummary!: string;
  /** 1 = lowest … 4 = highest merry-go-round priority */
  priorityRank!: number;
  priorityLabel!: string;
  distributionSummary!: string;
  includedLeadCreditsSummary!: string | null;
  filterScope!: SubscriptionPlanFilterScopeDto;
  /** Short bullets for cards */
  cardHighlights!: string[];
  /** Full list for modal */
  featureBullets!: string[];
  /** True when STRIPE_PRICE_ID_* is set for this plan */
  stripeConfigured!: boolean;
}
