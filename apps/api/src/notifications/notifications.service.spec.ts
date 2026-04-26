import { ConfigService } from '@nestjs/config'
import { PurchaseType } from '../../common/enums/purchase-type.enum'
import { NotificationsService } from './notifications.service'
import { createQueryBuilderMock, createRepositoryMock } from '../../test/helpers/testing'
import { buildUser } from '../../test/helpers/fixtures'

describe('NotificationsService', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function createService(configValues?: Record<string, string>) {
    const logRepo = createRepositoryMock<any>()
    const userRepo = createRepositoryMock<any>()
    const marketAlertRepo = createRepositoryMock<any>()
    const config = {
      get: jest.fn((key: string) => configValues?.[key] ?? ''),
    } as unknown as ConfigService

    const service = new NotificationsService(
      logRepo as any,
      userRepo as any,
      marketAlertRepo as any,
      config,
    )

    return { service, logRepo, userRepo, marketAlertRepo }
  }

  it('creates an in-app notification log even when email is not configured', async () => {
    const { service, logRepo, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser())
    logRepo.create.mockImplementation((value) => value)
    logRepo.save.mockImplementation(async (value) => value)

    await service.sendUserEvent({
      userId: 'user-1',
      type: 'wallet_credit',
      title: 'Wallet funded',
      body: 'Your wallet was funded.',
    })

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'wallet_credit',
        title: 'Wallet funded',
        channel: 'in_app',
      }),
    )
  })

  it('logs email notifications when email delivery succeeds', async () => {
    const { service, logRepo, userRepo } = createService({
      RESEND_API_KEY: 're_123',
      NOTIFICATION_FROM_EMAIL: 'alerts@example.com',
    })
    userRepo.findOne.mockResolvedValue(buildUser())
    logRepo.create.mockImplementation((value) => value)
    logRepo.save.mockImplementation(async (value) => value)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any)

    await service.notifyWalletFunded('user-1', 2500, '7000', 'tx-1')

    expect(global.fetch).toHaveBeenCalled()
    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        title: 'Wallet funded',
      }),
    )
  })

  it('formats auto-buy purchases distinctly in notifications', async () => {
    const { service, userRepo, logRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser())
    logRepo.create.mockImplementation((value) => value)
    logRepo.save.mockImplementation(async (value) => value)

    await service.logPurchase('user-1', 'Dallas Fixer Upper', '1500', 'lead-1', PurchaseType.AUTO_BUY)

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Lead auto-purchased',
      }),
    )
  })

  it('matches instant market alerts and respects max alerts per day', async () => {
    const { service, marketAlertRepo, logRepo, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser())
    logRepo.create.mockImplementation((value) => value)
    logRepo.save.mockImplementation(async (value) => value)
    logRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      }),
    )
    marketAlertRepo.find.mockResolvedValue([
      {
        is_active: true,
        frequency: 'instant',
        market: 'Dallas',
        filters: { lead_type: 'seller', max_price_cents: 2000 },
        max_per_day: 3,
        user: buildUser({ id: 'user-1' }),
      },
    ])

    await service.notifyMarketAlertsForLead({
      id: 'lead-1',
      title: 'Dallas Fixer Upper',
      market: 'Dallas',
      lead_type: 'seller',
      exclusivity_level: 'premium',
      price_cents: '1500',
    })

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'market_alert_match',
        reference_id: 'lead-1',
      }),
    )
  })
})
