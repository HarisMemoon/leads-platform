import { PingMatchingService } from './ping-matching.service';
import { createRepositoryMock } from '../../test/helpers/testing';

describe('PingMatchingService', () => {
  function makeService() {
    const pricingRepo = createRepositoryMock<any>();
    const auditRepo = createRepositoryMock<any>();
    const eligibility = { check: jest.fn() };
    const service = new PingMatchingService(pricingRepo as any, auditRepo as any, eligibility as any);
    auditRepo.create.mockImplementation((value) => value);
    auditRepo.save.mockImplementation(async (value) => value);
    return { service, pricingRepo, auditRepo, eligibility };
  }

  const ping = {
    id: 'ping-1',
    market: 'Houston, TX',
    city: 'Houston',
    state: 'TX',
    zip: '77084',
    county: null,
    property_type: 'sfh',
    lead_type: 'inbound',
    exclusivity_choice: 'exclusive',
  } as any;

  it('rejects when no buyer pricing rules qualify', async () => {
    const { service, pricingRepo } = makeService();
    pricingRepo.find.mockResolvedValue([]);

    await expect(service.match(ping)).resolves.toEqual({
      accepted: false,
      rejectionReason: 'no_eligible_buyers',
    });
  });

  it('selects the highest priced eligible buyer after priority ties', async () => {
    const { service, pricingRepo, eligibility } = makeService();
    pricingRepo.find.mockResolvedValue([
      {
        id: 'rule-a',
        name: 'A',
        user: { id: 'buyer-a', is_active: true },
        markets: ['Houston, TX'],
        states: [],
        cities: [],
        zips: [],
        counties: [],
        property_types: [],
        lead_types: ['inbound'],
        fixed_price_cents: null,
        max_bid_cents: '12500',
        priority: 1,
        exclusivity_preference: 'both',
        routing_strategy: 'highest_bid',
        created_at: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'rule-b',
        name: 'B',
        user: { id: 'buyer-b', is_active: true },
        markets: ['Houston, TX'],
        states: [],
        cities: [],
        zips: ['77084'],
        counties: [],
        property_types: [],
        lead_types: ['inbound'],
        fixed_price_cents: null,
        max_bid_cents: '15000',
        priority: 1,
        exclusivity_preference: 'both',
        routing_strategy: 'highest_bid',
        created_at: new Date('2026-01-02T00:00:00Z'),
      },
    ]);
    eligibility.check.mockResolvedValue({ eligible: true });

    await expect(service.match(ping)).resolves.toEqual({
      accepted: true,
      buyerId: 'buyer-b',
      pricingRuleId: 'rule-b',
      priceCents: '15000',
    });
  });

  it('records ineligible buyer reasons from eligibility checks', async () => {
    const { service, pricingRepo, auditRepo, eligibility } = makeService();
    pricingRepo.find.mockResolvedValue([
      {
        id: 'rule-a',
        name: 'A',
        user: { id: 'buyer-a', is_active: true },
        markets: [],
        states: [],
        cities: [],
        zips: [],
        counties: [],
        property_types: [],
        lead_types: [],
        fixed_price_cents: '10000',
        max_bid_cents: null,
        priority: 0,
        exclusivity_preference: 'both',
        routing_strategy: 'highest_bid',
        created_at: new Date(),
      },
    ]);
    eligibility.check.mockResolvedValue({
      eligible: false,
      reason: 'insufficient_wallet_balance',
    });

    await service.match(ping);

    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eligible: false,
        price_cents: '10000',
        rejection_reason: 'insufficient_wallet_balance',
      }),
    );
  });
});
