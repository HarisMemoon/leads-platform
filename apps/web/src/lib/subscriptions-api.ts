import { apiGet, apiPost } from '@/lib/api';

export type SubscriptionPlanFilterScope = {
  state: boolean;
  county: boolean;
  zip: boolean;
  leadType: boolean;
};

export type SubscriptionPlanCatalogItem = {
  planType: 'basic' | 'pro' | 'market_specific' | 'premium';
  name: string;
  tagline: string;
  displayPrice: string;
  billingPeriodLabel: string;
  monthlyLeadLimit: number | null;
  leadLimitSummary: string;
  priorityRank: number;
  priorityLabel: string;
  distributionSummary: string;
  includedLeadCreditsSummary: string | null;
  filterScope: SubscriptionPlanFilterScope;
  cardHighlights: string[];
  featureBullets: string[];
  stripeConfigured: boolean;
};

export type SubscriptionDto = {
  id: string;
  plan_type: 'basic' | 'pro' | 'market_specific' | 'premium';
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: 'active' | 'paused' | 'cancelled' | 'past_due';
  priority_weight: number;
  current_period_start: string;
  current_period_end: string;
  monthly_lead_limit: number | null;
  leads_used_this_period: number;
  markets: string[];
  created_at: string;
  updated_at: string;
};

export function getMySubscription() {
  return apiGet<SubscriptionDto | null>('/subscriptions/me');
}

export function getSubscriptionPlans() {
  return apiGet<SubscriptionPlanCatalogItem[]>('/subscriptions/plans');
}

export type SubscriptionCheckoutResponse = {
  url: string;
};

export function checkoutSubscription(planType: SubscriptionDto['plan_type']) {
  return apiPost<SubscriptionCheckoutResponse>('/subscriptions/checkout', { planType });
}

export function syncSubscriptionCheckout(sessionId: string) {
  return apiPost<SubscriptionDto | null>('/subscriptions/checkout/sync', { sessionId });
}

export function cancelSubscription() {
  return apiPost<SubscriptionDto>('/subscriptions/cancel');
}

export function createCustomerPortal() {
  return apiPost<{ url: string }>('/stripe/customer-portal');
}

