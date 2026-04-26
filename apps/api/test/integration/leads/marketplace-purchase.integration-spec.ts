import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { LeadsService } from '../../../src/leads/leads.service'
import { Lead } from '../../../src/entities/lead.entity'
import { LeadPriceHistory } from '../../../src/entities/lead-price-history.entity'
import { WalletTransaction } from '../../../src/entities/wallet-transaction.entity'
import { LeadAssignment } from '../../../src/entities/lead-assignment.entity'
import { LeadAssignmentEvent } from '../../../src/entities/lead-assignment-event.entity'
import { Subscription } from '../../../src/entities/subscription.entity'
import { WalletService } from '../../../src/wallet/wallet.service'
import { DistributionService } from '../../../src/distribution/distribution.service'
import { LeadPricingService } from '../../../src/leads/lead-pricing.service'
import { NotificationsService } from '../../../src/notifications/notifications.service'
import { IntegrationsService } from '../../../src/integrations/integrations.service'
import { createDataSourceMock, createQueryBuilderMock, createQueryRunnerMock, createRepositoryMock } from '../../helpers/testing'
import { buildAssignment, buildLead, buildWallet } from '../../helpers/fixtures'

describe('Marketplace purchase flow (integration)', () => {
  it('wires the lead purchase path through the real service with DI-managed collaborators', async () => {
    const leadRepo = createRepositoryMock<any>()
    const leadPriceHistoryRepo = createRepositoryMock<any>()
    const walletTransactionRepo = createRepositoryMock<any>()
    const leadAssignmentRepo = createRepositoryMock<any>()
    const assignmentEventRepo = createRepositoryMock<any>()
    const subscriptionRepo = createRepositoryMock<any>()
    const queryRunner = createQueryRunnerMock()
    const dataSource = createDataSourceMock(queryRunner)
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
      logPurchase: jest.fn(),
      notifyMarketAlertsForLead: jest.fn(),
    }
    const integrationsService = {
      emitCustomWebhookEvent: jest.fn(),
    }
    const config = {
      get: jest.fn((key: string) => (key === 'LEAD_RESERVE_TTL_SECONDS' ? '120' : undefined)),
    }
    const lead = buildLead({ price_cents: '1500' })
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getRepositoryToken(Lead), useValue: leadRepo },
        { provide: getRepositoryToken(LeadPriceHistory), useValue: leadPriceHistoryRepo },
        { provide: getRepositoryToken(WalletTransaction), useValue: walletTransactionRepo },
        { provide: getRepositoryToken(LeadAssignment), useValue: leadAssignmentRepo },
        { provide: getRepositoryToken(LeadAssignmentEvent), useValue: assignmentEventRepo },
        { provide: getRepositoryToken(Subscription), useValue: subscriptionRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: WalletService, useValue: walletService },
        { provide: DistributionService, useValue: distributionService },
        { provide: LeadPricingService, useValue: leadPricingService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: IntegrationsService, useValue: integrationsService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile()

    const service = moduleRef.get(LeadsService)
    const result = await service.buyLead('buyer-1', lead.id)

    expect(result.amount_charged_cents).toBe('1500')
    expect(walletService.debitWallet).toHaveBeenCalledWith(
      'buyer-1',
      1500,
      'lead_purchase',
      lead.id,
      'Lead purchase',
    )
    expect(notificationsService.logPurchase).toHaveBeenCalled()
  })
})
