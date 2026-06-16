import { BadRequestException } from '@nestjs/common'
import { LeadDistributionProcessor } from './lead-distribution.processor'
import { LeadStatus } from '../../common/enums/lead-status.enum'
import { createQueryBuilderMock, createRepositoryMock } from '../../test/helpers/testing'
import { buildDistributionRule, buildLead, buildSubscription, buildWallet } from '../../test/helpers/fixtures'

describe('LeadDistributionProcessor', () => {
  const leadsService = {
    buyLead: jest.fn(),
  }
  const distributionService = {
    enqueueLeadDistribution: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createProcessor() {
    const leadRepo = createRepositoryMock<any>()
    const subscriptionRepo = createRepositoryMock<any>()
    const distributionRuleRepo = createRepositoryMock<any>()
    const walletRepo = createRepositoryMock<any>()
    const leadAssignmentRepo = createRepositoryMock<any>()
    const engineSettingsRepo = createRepositoryMock<any>()

    const termsRepo = createRepositoryMock<any>()
    const processor = new LeadDistributionProcessor(
      leadRepo as any,
      subscriptionRepo as any,
      distributionRuleRepo as any,
      walletRepo as any,
      leadAssignmentRepo as any,
      engineSettingsRepo as any,
      termsRepo as any,
      leadsService as any,
      distributionService as any,
    )

    return {
      processor,
      leadRepo,
      subscriptionRepo,
      distributionRuleRepo,
      walletRepo,
      leadAssignmentRepo,
      engineSettingsRepo,
    }
  }

  it('stops immediately when the engine is paused', async () => {
    const { processor, engineSettingsRepo, leadRepo } = createProcessor()
    engineSettingsRepo.findOne.mockResolvedValue({ queue_paused: true })

    await processor.processLead({ data: { leadId: 'lead-1' } } as any)

    expect(leadRepo.findOne).not.toHaveBeenCalled()
  })

  it('creates default engine settings when none exist', async () => {
    const { processor, engineSettingsRepo, leadRepo, subscriptionRepo } = createProcessor()
    engineSettingsRepo.findOne.mockResolvedValue(null)
    engineSettingsRepo.create.mockImplementation((value) => value)
    engineSettingsRepo.save.mockResolvedValue({
      id: 'settings-1',
      queue_paused: false,
      max_auto_distribution_runs: 10,
      cooldown_minutes_between_runs: 15,
      markdown_after_days: 7,
      markdown_percent: 10,
    })
    leadRepo.findOne.mockResolvedValue(buildLead({ status: LeadStatus.AVAILABLE }))
    subscriptionRepo.find.mockResolvedValue([])

    await processor.processLead({ data: { leadId: 'lead-1' } } as any)

    expect(engineSettingsRepo.save).toHaveBeenCalled()
    expect(distributionService.enqueueLeadDistribution).toHaveBeenCalled()
  })

  it('auto-purchases a lead for the first eligible buyer and increments usage', async () => {
    const {
      processor,
      engineSettingsRepo,
      leadRepo,
      subscriptionRepo,
      distributionRuleRepo,
      walletRepo,
      leadAssignmentRepo,
    } = createProcessor()
    const lead = buildLead({ market: 'Dallas', lead_type: 'seller', price_cents: '1500' })
    const subscription = buildSubscription({
      user: { id: 'buyer-1' },
      leads_used_this_period: 1,
      monthly_lead_limit: 10,
      priority_weight: 5,
    })
    const rule = buildDistributionRule({
      user: { id: 'buyer-1' },
      market_filters: ['Dallas'],
      lead_type_filters: ['seller'],
      min_wallet_balance_cents: '500',
      max_spend_per_day_cents: '5000',
      max_spend_per_week_cents: '10000',
      max_spend_per_month_cents: '20000',
    })

    engineSettingsRepo.findOne.mockResolvedValue({
      queue_paused: false,
      max_auto_distribution_runs: 10,
      cooldown_minutes_between_runs: 15,
    })
    leadRepo.findOne.mockResolvedValue(lead)
    subscriptionRepo.find.mockResolvedValue([subscription])
    subscriptionRepo.save.mockImplementation(async (value) => value)
    distributionRuleRepo.find.mockResolvedValue([rule])
    walletRepo.findOne.mockResolvedValue(buildWallet({ user: { id: 'buyer-1' }, balance_cents: '5000' }))
    leadAssignmentRepo.count.mockResolvedValue(0)
    leadAssignmentRepo.findOne.mockResolvedValue(null)
    leadAssignmentRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
      }),
    )

    await processor.processLead({ data: { leadId: lead.id } } as any)

    expect(leadsService.buyLead).toHaveBeenCalledWith('buyer-1', lead.id, 'auto_buy')
    expect(subscription.leads_used_this_period).toBe(2)
    expect(subscriptionRepo.save).toHaveBeenCalledWith(subscription)
  })

  it('schedules a retry when all buyers fail eligibility or purchase checks', async () => {
    const {
      processor,
      engineSettingsRepo,
      leadRepo,
      subscriptionRepo,
      distributionRuleRepo,
      walletRepo,
      leadAssignmentRepo,
    } = createProcessor()
    const lead = buildLead({ distribution_run_count: 0 })
    engineSettingsRepo.findOne.mockResolvedValue({
      queue_paused: false,
      max_auto_distribution_runs: 3,
      cooldown_minutes_between_runs: 15,
    })
    leadRepo.findOne
      .mockResolvedValueOnce(lead)
      .mockResolvedValueOnce(lead)
    leadRepo.save.mockImplementation(async (value) => value)
    subscriptionRepo.find.mockResolvedValue([buildSubscription({ user: { id: 'buyer-1' } })])
    distributionRuleRepo.find.mockResolvedValue([buildDistributionRule({ user: { id: 'buyer-1' } })])
    walletRepo.findOne.mockResolvedValue(buildWallet({ user: { id: 'buyer-1' }, balance_cents: '5000' }))
    leadAssignmentRepo.count.mockResolvedValue(0)
    leadAssignmentRepo.findOne.mockResolvedValue(null)
    leadAssignmentRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
      }),
    )
    leadsService.buyLead.mockRejectedValueOnce(new BadRequestException('locked'))

    await processor.processLead({ data: { leadId: lead.id } } as any)

    expect(lead.distribution_run_count).toBe(1)
    expect(distributionService.enqueueLeadDistribution).toHaveBeenCalledWith(lead.id, {
      delay: 15 * 60 * 1000,
    })
  })
})
