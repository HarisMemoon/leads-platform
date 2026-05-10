import { PingEligibilityService } from './ping-eligibility.service';
import { createQueryBuilderMock, createRepositoryMock } from '../../test/helpers/testing';

describe('PingEligibilityService', () => {
  function makeService() {
    const ruleRepo = createRepositoryMock<any>();
    const walletRepo = createRepositoryMock<any>();
    const assignmentRepo = createRepositoryMock<any>();
    const service = new PingEligibilityService(ruleRepo as any, walletRepo as any, assignmentRepo as any);
    assignmentRepo.count.mockResolvedValue(0);
    assignmentRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({ getRawOne: jest.fn().mockResolvedValue({ sum: '0' }) }),
    );
    return { service, ruleRepo, walletRepo, assignmentRepo };
  }

  const activeRule = {
    participation_enabled: true,
    is_active: true,
    market_filters: ['Houston, TX'],
    lead_type_filters: ['inbound'],
    max_lead_price_cents: '20000',
    min_wallet_balance_cents: '2500',
    max_per_day: 5,
    max_leads_per_week: null,
    max_leads_per_month: null,
    max_spend_per_day_cents: null,
    max_spend_per_week_cents: null,
    max_spend_per_month_cents: null,
    cooldown_minutes: 0,
  };

  it('accepts a buyer with matching coverage and enough wallet balance', async () => {
    const { service, ruleRepo, walletRepo } = makeService();
    ruleRepo.findOne.mockResolvedValue(activeRule);
    walletRepo.findOne.mockResolvedValue({ balance_cents: '20000' });

    await expect(
      service.check({
        buyerId: 'buyer-1',
        priceCents: 15000n,
        market: 'Houston, TX',
        leadType: 'inbound',
      }),
    ).resolves.toEqual(expect.objectContaining({ eligible: true }));
  });

  it('rejects when wallet balance cannot preserve the configured reserve', async () => {
    const { service, ruleRepo, walletRepo } = makeService();
    ruleRepo.findOne.mockResolvedValue(activeRule);
    walletRepo.findOne.mockResolvedValue({ balance_cents: '16000' });

    await expect(
      service.check({
        buyerId: 'buyer-1',
        priceCents: 15000n,
        market: 'Houston, TX',
        leadType: 'inbound',
      }),
    ).resolves.toEqual(expect.objectContaining({ eligible: false, reason: 'wallet_reserve_required' }));
  });

  it('rejects when the daily cap has been reached', async () => {
    const { service, ruleRepo, walletRepo, assignmentRepo } = makeService();
    ruleRepo.findOne.mockResolvedValue(activeRule);
    walletRepo.findOne.mockResolvedValue({ balance_cents: '20000' });
    assignmentRepo.count.mockResolvedValue(5);

    await expect(
      service.check({
        buyerId: 'buyer-1',
        priceCents: 15000n,
        market: 'Houston, TX',
        leadType: 'inbound',
      }),
    ).resolves.toEqual(expect.objectContaining({ eligible: false, reason: 'daily_lead_cap_reached' }));
  });
});
