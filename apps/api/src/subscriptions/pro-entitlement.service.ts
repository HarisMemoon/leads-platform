import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { PlanType } from '../../common/enums/plan-type.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';

/**
 * Encapsulates all Pro-tier entitlement checks so every consumer (leads,
 * distribution, notifications) consults one authoritative source.
 *
 * Entitlements for the Pro plan:
 *   - 10% discount on every lead purchase
 *   - Exclusive purchase access during the 60-min early-access window
 *   - Priority (immediate) market-alert notifications
 */
@Injectable()
export class ProEntitlementService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  /** Returns true when the user has an active Pro subscription. */
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

  /**
   * Returns the effective price after applying the Pro 10% discount.
   * Non-Pro users receive the full price unchanged.
   */
  async discountedPriceCents(
    userId: string,
    priceCents: bigint,
  ): Promise<bigint> {
    if (await this.isPro(userId)) {
      return (priceCents * 9n) / 10n; // floor division — 10% off
    }
    return priceCents;
  }

  /**
   * Returns true when the user is allowed to purchase (or auto-buy) a lead.
   *
   * During the early-access window (lead.early_access_until is in the future)
   * only Pro subscribers may proceed.  Outside the window everyone may buy.
   */
  async canBuyDuringEarlyAccess(
    userId: string,
    lead: { early_access_until: Date | null },
  ): Promise<boolean> {
    if (
      !lead.early_access_until ||
      new Date() > new Date(lead.early_access_until)
    ) {
      return true; // window has passed — open to all
    }
    return this.isPro(userId);
  }
}
