import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { DistributionRulesService } from './distribution-rules.service'
import { createRepositoryMock } from '../../test/helpers/testing'
import { buildDistributionRule, buildUser } from '../../test/helpers/fixtures'

describe('DistributionRulesService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService() {
    const ruleRepo = createRepositoryMock<any>()
    const userRepo = createRepositoryMock<any>()
    const subscriptionRepo = createRepositoryMock<any>()
    const walletRepo = createRepositoryMock<any>()
    const termsRepo = createRepositoryMock<any>()
    const config = { get: jest.fn().mockReturnValue('2025-01') }
    subscriptionRepo.findOne.mockResolvedValue({ status: 'active', current_period_end: null })
    const service = new DistributionRulesService(
      ruleRepo as any,
      userRepo as any,
      subscriptionRepo as any,
      walletRepo as any,
      termsRepo as any,
      config as any,
    )
    return { service, ruleRepo, userRepo, subscriptionRepo }
  }

  it('blocks updates when distribution settings are locked', async () => {
    const { service, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ distribution_locked: true }))

    await expect(
      service.upsertMe('user-1', { participation_enabled: true }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('throws when there is no distribution rule yet', async () => {
    const { service, ruleRepo } = createService()
    ruleRepo.findOne.mockResolvedValue(null)

    await expect(service.getMe('user-1')).rejects.toThrow(NotFoundException)
  })

  it('creates a default rule when the buyer does not have one yet', async () => {
    const { service, ruleRepo, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ distribution_locked: false }))
    ruleRepo.findOne.mockResolvedValue(null)
    ruleRepo.create.mockImplementation((value) => value)
    ruleRepo.save.mockImplementation(async (value) => value)

    const result = await service.upsertMe('user-1', {
      participation_enabled: true,
      market_filters: ['Dallas'],
      min_wallet_balance_cents: 500,
      max_spend_per_day_cents: 2000,
    })

    expect(result).toEqual(
      expect.objectContaining({
        participation_enabled: true,
        market_filters: ['Dallas'],
        min_wallet_balance_cents: '500',
        max_spend_per_day_cents: '2000',
      }),
    )
  })

  it('blocks enabling Auto Purchase for non-Pro buyers', async () => {
    const { service, userRepo, subscriptionRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ distribution_locked: false }))
    subscriptionRepo.findOne.mockResolvedValue(null)

    await expect(
      service.upsertMe('user-1', { participation_enabled: true }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('prevents buyers from updating rules they do not own', async () => {
    const { service, ruleRepo, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ distribution_locked: false }))
    ruleRepo.findOne.mockResolvedValue(buildDistributionRule({ user: buildUser({ id: 'other-user' }) }))

    await expect(
      service.updateOwnRule('user-1', 'rule-1', { participation_enabled: false }),
    ).rejects.toThrow(ForbiddenException)
  })
})
