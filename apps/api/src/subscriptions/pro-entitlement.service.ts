import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { PlanType } from '../../common/enums/plan-type.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

/**
 * Subscription entitlement checks used by leads, distribution, and notifications.
 *
 * The $99/month subscription ("Pro" plan internally) unlocks:
 *   - Shared lead purchases at flat subscription pricing
 *     · Inbound leads: $30 each (up to 5 buyers)
 *     · Outbound leads: $20 each (up to 3 buyers)
 *   - Early-access window for new leads (60 min head start)
 *   - Auto-buy distribution participation
 *
 * Non-subscribers may only purchase exclusive leads at the full exclusive price.
 */

/** Flat subscription price for inbound shared leads: $30 */
export const SUBSCRIPTION_PRICE_INBOUND_CENTS = 3000n;
/** Flat subscription price for outbound shared leads: $20 */
export const SUBSCRIPTION_PRICE_OUTBOUND_CENTS = 2000n;

@Injectable()
export class ProEntitlementService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  /** Returns true when the user has an active subscription. */
  async isPro(userId: string): Promise<boolean> {
    const row = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        plan_type: PlanType.PRO,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    return row !== null;
  }

  /** Alias for isPro — use when the context is about shared-lead access. */
  async canBuySharedLead(userId: string): Promise<boolean> {
    return this.isPro(userId);
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
