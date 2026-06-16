import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LeadsService } from './leads.service'
import { LeadStatus } from '../../common/enums/lead-status.enum'
import { PurchaseType } from '../../common/enums/purchase-type.enum'
import { createDataSourceMock, createQueryBuilderMock, createQueryRunnerMock, createRepositoryMock } from '../../test/helpers/testing'
import { buildAssignment, buildLead, buildWallet } from '../../test/helpers/fixtures'

describe('LeadsService', () => {
  const walletService = {
    debitWallet: jest.fn(),
  }
  const distributionService = {
    enqueueLeadDistribution: jest.fn(),
  }
  const leadPricingService = {
    applyTierToLead: jest.fn(),
  }
  const notificationsService = {
    notifyMarketAlertsForLead: jest.fn(),
    logPurchase: jest.fn(),
  }
  const integrationsService = {
    emitCustomWebhookEvent: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService() {
    const leadRepo = createRepositoryMock<any>()
    const leadPriceHistoryRepo = createRepositoryMock<any>()
    const walletTransactionRepo = createRepositoryMock<any>()
    const leadAssignmentRepo = createRepositoryMock<any>()
    const assignmentEventRepo = createRepositoryMock<any>()
    const subscriptionRepo = createRepositoryMock<any>()
    const queryRunner = createQueryRunnerMock()
    const dataSource = createDataSourceMock(queryRunner)
    const config = {
      get: jest.fn((key: string) =>
        key === 'LEAD_RESERVE_TTL_SECONDS' ? '120' : undefined,
      ),
    } as unknown as ConfigService

    const leadPricingConfigService = {
      getPricesForLead: jest.fn().mockResolvedValue({ exclusive: '15000', shared: '2500' }),
    };
    const service = new LeadsService(
      leadRepo as any,
      leadPriceHistoryRepo as any,
      walletTransactionRepo as any,
      leadAssignmentRepo as any,
      assignmentEventRepo as any,
      subscriptionRepo as any,
      {} as any, // distributionRuleRepo
      dataSource as any,
      walletService as any,
      distributionService as any,
      leadPricingService as any,
      notificationsService as any,
      integrationsService as any,
      config,
      {} as any, // proEntitlementService
      leadPricingConfigService as any,
    )

    return { service, leadRepo, leadAssignmentRepo, queryRunner }
  }

  it('reserves an available lead for the current buyer', async () => {
    const { service, queryRunner } = createService()
    const lead = buildLead({ status: LeadStatus.AVAILABLE })
    ;(queryRunner.manager.getRepository as jest.Mock).mockReturnValue({
      createQueryBuilder: jest.fn(() => {
        const qb = createQueryBuilderMock()
        qb.getOne.mockResolvedValue(lead)
        return qb
      }),
    })
    ;(queryRunner.manager.save as jest.Mock).mockImplementation(async (value) => value)

    const result = await service.reserveLead('buyer-1', 'lead-1')

    expect(result.ttl_seconds).toBe(120)
    expect(lead.status).toBe(LeadStatus.RESERVED)
    expect((lead.reserved_by_user as any).id).toBe('buyer-1')
    expect(queryRunner.commitTransaction).toHaveBeenCalled()
  })

  it('rejects buying a reserved lead when another buyer holds the reservation', async () => {
    const { service, queryRunner, leadRepo } = createService()
    const lead = buildLead({ status: LeadStatus.RESERVED, reserved_until: new Date(Date.now() + 60_000) })
    ;(queryRunner.manager.getRepository as jest.Mock).mockReturnValue({
      createQueryBuilder: jest.fn(() => {
        const qb = createQueryBuilderMock()
        qb.getOne.mockResolvedValue(lead)
        qb.getCount.mockResolvedValue(0)
        return qb
      }),
    })
    ;(queryRunner.manager.query as jest.Mock).mockResolvedValue([{ reserved_by_user_id: 'other-buyer' }])
    leadRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    )

    await expect(service.buyLead('buyer-1', 'lead-1')).rejects.toThrow(
      'Lead is reserved by another buyer',
    )
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled()
  })

  it('rejects buying a lead when wallet balance is insufficient', async () => {
    const { service, queryRunner, leadRepo } = createService()
    const lead = buildLead({ price_cents: '1500' })
    ;(queryRunner.manager.getRepository as jest.Mock).mockReturnValue({
      createQueryBuilder: jest.fn(() => {
        const qb = createQueryBuilderMock()
        qb.getOne.mockResolvedValue(lead)
        qb.getCount.mockResolvedValue(0)
        return qb
      }),
    })
    ;(queryRunner.manager.findOne as jest.Mock).mockResolvedValue(buildWallet({ balance_cents: '500' }))
    leadRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    )

    await expect(service.buyLead('buyer-1', 'lead-1')).rejects.toThrow(
      'Insufficient wallet balance',
    )
  })

  it('sells an available lead, creates an assignment, and debits the wallet', async () => {
    const { service, queryRunner, leadRepo } = createService()
    const lead = buildLead({ status: LeadStatus.AVAILABLE, price_cents: '1500' })
    const assignment = buildAssignment({ lead, amount_charged_cents: '1500' })
    ;(queryRunner.manager.getRepository as jest.Mock).mockReturnValue({
      createQueryBuilder: jest.fn(() => {
        const qb = createQueryBuilderMock()
        qb.getOne.mockResolvedValue(lead)
        qb.getCount.mockResolvedValue(0)
        return qb
      }),
    })
    ;(queryRunner.manager.findOne as jest.Mock).mockResolvedValue(buildWallet({ balance_cents: '5000' }))
    ;(queryRunner.manager.create as jest.Mock).mockImplementation((_: unknown, input: unknown) => input)
    ;(queryRunner.manager.save as jest.Mock).mockImplementation(async (value) => {
      if ((value as any).purchase_type) {
        return assignment
      }
      return value
    })
    leadRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    )

    const result = await service.buyLead('buyer-1', 'lead-1', PurchaseType.AUTO_BUY)

    expect(result).toBe(assignment)
    expect(lead.status).toBe(LeadStatus.SOLD)
    expect(walletService.debitWallet).toHaveBeenCalledWith(
      'buyer-1',
      1500,
      'lead_purchase',
      'lead-1',
      'Lead purchase',
    )
    expect(notificationsService.logPurchase).toHaveBeenCalledWith(
      'buyer-1',
      lead.title,
      assignment.amount_charged_cents,
      lead.id,
      PurchaseType.AUTO_BUY,
    )
  })

  it('rejects duplicate canonical leads already assigned to the same buyer', async () => {
    const { service, queryRunner, leadRepo } = createService()
    const lead = buildLead({ price_cents: '1500' })
    ;(queryRunner.manager.getRepository as jest.Mock).mockImplementation((entity) => ({
      createQueryBuilder: jest.fn(() => {
        const qb = createQueryBuilderMock()
        if (entity?.name === 'LeadAssignment') {
          qb.getCount.mockResolvedValue(1)
        } else {
          qb.getOne.mockResolvedValue(lead)
        }
        return qb
      }),
    }))
    ;(queryRunner.manager.findOne as jest.Mock).mockResolvedValue(buildWallet({ balance_cents: '5000' }))
    leadRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(buildLead({ id: 'prior-lead' })),
      }),
    )

    await expect(service.buyLead('buyer-1', 'lead-1')).rejects.toThrow(
      'This lead matches a lead already assigned to your account',
    )
  })
})
