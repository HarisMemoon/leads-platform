import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { PlanType } from '../../common/enums/plan-type.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

/**
 * Subscription entitlement checks used by leads, distribution, and notifications.
 *
 * The $49/month subscription ("Pro" plan) unlocks:
 *   - Shared inbound lead purchases at $25 each (up to 5 buyers)
 *   - Exclusive lead purchases at $150 each
 *   - Early-access window for new leads (60 min head start)
 *   - Auto-buy distribution participation
 *
 * Non-subscribers may only purchase exclusive leads at $150 each.
 */

/** Flat subscription price for inbound shared leads: $25 */
export const SUBSCRIPTION_PRICE_INBOUND_CENTS = 2500n;
/** Default exclusive price for inbound leads: $150 */
export const INBOUND_EXCLUSIVE_PRICE_CENTS = 15000n;
/** Default exclusive price for outbound leads: $75 */
export const OUTBOUND_EXCLUSIVE_PRICE_CENTS = 7500n;
/** Flat subscription price for outbound shared leads: $25 */
export const SUBSCRIPTION_PRICE_OUTBOUND_CENTS = 2500n;

@Injectable()
export class ProEntitlementService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  /**
   * Returns true when the user has Pro access.
   *
   * Rules:
   *  - ACTIVE  → always Pro.
   *  - CANCELLED → still Pro until current_period_end (grace period: customer
   *    paid for the full billing cycle, they keep access until it expires).
   *  - PAST_DUE / anything else → not Pro.
   */
  async isPro(userId: string): Promise<boolean> {
    const row = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        plan_type: PlanType.PRO,
      },
      order: { created_at: 'DESC' },
    });
    if (!row) return false;
    if (row.status === SubscriptionStatus.ACTIVE) return true;
    if (
      row.status === SubscriptionStatus.CANCELLED &&
      row.current_period_end != null &&
      new Date(row.current_period_end) > new Date()
    ) {
      return true; // within paid period — honour access until period ends
    }
    return false;
  }

  /** Alias for isPro — use when the context is about shared-lead access. */
  async canBuySharedLead(userId: string): Promise<boolean> {
    return this.isPro(userId);
  }

  /**
   * Returns true when the user has a cancelled subscription whose billing period
   * has already ended. These users may only purchase exclusive leads (wallet
   * balance remains usable but shared-lead access is revoked).
   */
  async isCancelledExpired(userId: string): Promise<boolean> {
    const row = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        plan_type: PlanType.PRO,
        status: SubscriptionStatus.CANCELLED,
      },
      order: { created_at: 'DESC' },
    });
    if (!row) return false;
    if (row.current_period_end == null) return true;
    return new Date(row.current_period_end) <= new Date();
  }

  /**
   * Returns the flat subscription price for a shared lead based on lead_type.
   * Inbound → $30, Outbound → $20.
   */
  getSharedLeadPrice(leadType: string): bigint {
    return leadType === 'outbound'
      ? SUBSCRIPTION_PRICE_OUTBOUND_CENTS
      : SUBSCRIPTION_PRICE_INBOUND_CENTS;
  }

  /**
   * Returns the price unchanged. Pricing is flat (set at lead creation) rather
   * than a percentage discount — kept for call-site compatibility.
   */
  async discountedPriceCents(
    _userId: string,
    priceCents: bigint,
  ): Promise<bigint> {
    return priceCents;
  }

  /**
   * Returns true when the user is allowed to purchase (or auto-buy) a lead.
   * During the early-access window only subscribers may proceed.
   */
  async canBuyDuringEarlyAccess(
    userId: string,
    lead: { early_access_until: Date | null },
  ): Promise<boolean> {
    if (
      !lead.early_access_until ||
      new Date() > new Date(lead.early_access_until)
    ) {
      return true;
    }
    return this.isPro(userId);
  }
}
