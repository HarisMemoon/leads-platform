import { UserRole } from '../../common/enums/user-role.enum'
import { WalletTransactionType } from '../../common/enums/wallet-transaction-type.enum'
import { LeadStatus } from '../../common/enums/lead-status.enum'
import { ExclusivityLevel } from '../../common/enums/exclusivity-level.enum'
import { PurchaseType } from '../../common/enums/purchase-type.enum'
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum'
import { PlanType } from '../../common/enums/plan-type.enum'

export function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'buyer@example.com',
    role: UserRole.BUYER,
    full_name: 'Buyer One',
    company_name: 'Acme Investors',
    phone: '+15550001111',
    stripe_customer_id: 'cus_123',
    distribution_locked: false,
    ...overrides,
  }
}

export function buildWallet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wallet-1',
    user: buildUser(),
    balance_cents: '5000',
    currency: 'usd',
    auto_reload_enabled: false,
    auto_reload_opt_in: false,
    auto_reload_threshold_cents: null,
    auto_reload_amount_cents: null,
    stripe_payment_method_id: null,
    ...overrides,
  }
}

export function buildWalletTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    wallet: buildWallet(),
    type: WalletTransactionType.CREDIT,
    amount_cents: '1000',
    balance_after_cents: '6000',
    reference_type: 'stripe_topup',
    reference_id: 'pi_123',
    description: 'Wallet credit',
    ...overrides,
  }
}

export function buildLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    title: 'Dallas Fixer Upper',
    source: 'meta',
    market: 'Dallas',
    lead_type: 'seller',
    status: LeadStatus.AVAILABLE,
    exclusivity_level: ExclusivityLevel.EXCLUSIVE,
    quality_score: 82,
    price_cents: '1500',
    metadata: { phone: '+15550009999', email: 'seller@example.com' },
    distribution_run_count: 0,
    reserved_until: null,
    reserved_by_user: null,
    duplicate_of_lead: null,
    created_at: new Date('2026-04-01T00:00:00.000Z'),
    updated_at: new Date('2026-04-01T00:00:00.000Z'),
    ...overrides,
  }
}

export function buildAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assignment-1',
    buyer: buildUser(),
    lead: buildLead(),
    purchase_type: PurchaseType.MANUAL,
    amount_charged_cents: '1500',
    created_at: new Date('2026-04-01T00:00:00.000Z'),
    lifecycle_phase: 'new',
    ...overrides,
  }
}

export function buildSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    user: buildUser(),
    plan_type: PlanType.BASIC,
    stripe_subscription_id: 'sub_123',
    stripe_price_id: 'price_basic',
    status: SubscriptionStatus.ACTIVE,
    priority_weight: 1,
    current_period_start: new Date('2026-04-01T00:00:00.000Z'),
    current_period_end: new Date('2026-05-01T00:00:00.000Z'),
    monthly_lead_limit: 25,
    leads_used_this_period: 0,
    markets: ['Dallas'],
    ...overrides,
  }
}

export function buildDistributionRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    user: buildUser(),
    participation_enabled: true,
    max_per_day: 5,
    market: 'Dallas',
    market_filters: ['Dallas'],
    lead_type_filters: ['seller'],
    is_active: true,
    max_leads_per_day: 5,
    max_leads_per_week: 20,
    max_leads_per_month: 50,
    max_spend_per_day_cents: '5000',
    max_spend_per_week_cents: '15000',
    max_spend_per_month_cents: '40000',
    min_wallet_balance_cents: '500',
    cooldown_minutes: 0,
    rotation_position: 0,
    created_at: new Date('2026-04-01T00:00:00.000Z'),
    updated_at: new Date('2026-04-01T00:00:00.000Z'),
    ...overrides,
  }
}
