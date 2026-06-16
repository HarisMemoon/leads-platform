import { BadRequestException } from '@nestjs/common';
import { createQueryBuilderMock, createRepositoryMock } from '../../test/helpers/testing';
import { PurchaseType } from '../../common/enums/purchase-type.enum';
import { PingService } from './ping.service';

describe('PingService', () => {
  function makeService() {
    const vendorRepo = createRepositoryMock<any>();
    const pricingRuleRepo = createRepositoryMock<any>();
    const pingRepo = createRepositoryMock<any>();
    const postRepo = createRepositoryMock<any>();
    const auditRepo = createRepositoryMock<any>();
    const leadRepo = createRepositoryMock<any>();
    const hitRepo = createRepositoryMock<any>();
    const matcher = { match: jest.fn() };
    const leadsService = { buyLead: jest.fn() };
    const leadPricingService = { applyTierToLead: jest.fn(async (lead) => lead) };
    const outboundPingService = { pingAll: jest.fn().mockResolvedValue({ sold: false, attempts: 0 }) };
    const leadPricingConfigService = {
      getPricesForLead: jest.fn().mockResolvedValue({ exclusive: '15000', shared: '2500' }),
    };
    const distributionService = { enqueueLeadDistribution: jest.fn().mockResolvedValue(undefined) };
    const service = new PingService(
      vendorRepo as any,
      pricingRuleRepo as any,
      pingRepo as any,
      postRepo as any,
      auditRepo as any,
      leadRepo as any,
      hitRepo as any,
      {} as any,
      matcher as any,
      leadsService as any,
      leadPricingService as any,
      outboundPingService as any,
      leadPricingConfigService as any,
      distributionService as any,
    );

    vendorRepo.findOne.mockResolvedValue({
      id: 'vendor-1',
      name: 'Vendor',
      enabled: true,
      api_key_hash: 'hash',
      allowed_sources: [],
      ping_ttl_seconds: 900,
    });
    pingRepo.create.mockImplementation((value) => value);
    pingRepo.save.mockImplementation(async (value) => ({ ...value, id: value.id ?? 'ping-1' }));
    postRepo.create.mockImplementation((value) => value);
    postRepo.save.mockImplementation(async (value) => ({ ...value, id: value.id ?? 'post-1' }));
    leadRepo.create.mockImplementation((value) => value);
    leadRepo.save.mockImplementation(async (value) => ({ ...value, id: value.id ?? 'lead-1' }));
    leadRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({ getOne: jest.fn().mockResolvedValue(null) }),
    );
    hitRepo.create.mockImplementation((value) => value);
    hitRepo.save.mockImplementation(async (value) => ({ ...value, id: value.id ?? 'hit-1' }));

    return {
      service,
      vendorRepo,
      pingRepo,
      postRepo,
      leadRepo,
      hitRepo,
      matcher,
      leadsService,
      distributionService,
    };
  }

  it('rejects pings that match an existing duplicate lead', async () => {
    const { service, leadRepo } = makeService();
    leadRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock({ getOne: jest.fn().mockResolvedValue({ id: 'existing-lead' }) }),
    );

    await expect(
      service.receivePing('secret', {
        vendor_ping_id: 'vendor-ping-1',
        city: 'Houston',
        state: 'TX',
        zip: '77084',
        lead_type: 'inbound',
        metadata: { phone: '5551234567' },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        accepted: false,
        status: 'rejected',
        rejection_reason: 'duplicate_lead',
      }),
    );
  });

  it('rejects full posts for expired accepted pings', async () => {
    const { service, pingRepo } = makeService();
    pingRepo.findOne.mockResolvedValue({
      id: 'ping-1',
      status: 'accepted',
      matched_buyer: { id: 'buyer-1' },
      matched_price_cents: '15000',
      expires_at: new Date(Date.now() - 1000),
    });

    await expect(
      service.receivePost('secret', {
        ping_id: 'ping-1',
        vendor_lead_id: 'vendor-lead-1',
        seller_name: 'Seller',
        phone: '5551234567',
        address: '123 Main St',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('commits accepted posts through the vendor-ping purchase path', async () => {
    const { service, pingRepo, leadsService } = makeService();
    pingRepo.findOne.mockResolvedValue({
      id: 'ping-1',
      vendor_ping_id: 'vp-1',
      status: 'accepted',
      market: 'Houston, TX',
      city: 'Houston',
      state: 'TX',
      zip: '77084',
      lead_type: 'inbound',
      source: 'vendor',
      exclusivity_choice: 'exclusive',
      matched_buyer: { id: 'buyer-1' },
      matched_price_cents: '15000',
      expires_at: new Date(Date.now() + 900000),
      payload: {},
    });
    leadsService.buyLead.mockResolvedValue({
      id: 'assignment-1',
      amount_charged_cents: '15000',
    });

    await service.receivePost('secret', {
      ping_id: 'ping-1',
      vendor_lead_id: 'vendor-lead-1',
      seller_name: 'Seller',
      phone: '5551234567',
      address: '123 Main St',
    });

    expect(leadsService.buyLead).toHaveBeenCalledWith(
      'buyer-1',
      'lead-1',
      PurchaseType.VENDOR_PING,
      'exclusive',
    );
  });
});
