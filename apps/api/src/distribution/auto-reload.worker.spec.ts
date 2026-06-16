import { AutoReloadWorker } from './auto-reload.worker'
import { createDataSourceMock, createQueryBuilderMock, createQueryRunnerMock, createRepositoryMock } from '../../test/helpers/testing'
import { buildWallet } from '../../test/helpers/fixtures'

describe('AutoReloadWorker', () => {
  const stripeService = {
    chargeWalletAutoReload: jest.fn(),
  }

  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  function createWorker() {
    const walletRepo = createRepositoryMock<any>()
    const queryRunner = createQueryRunnerMock()
    const dataSource = createDataSourceMock(queryRunner)
    const notificationsService = {
      notifyAutoRefillSuccess: jest.fn().mockResolvedValue(undefined),
      notifyAutoRefillFailed: jest.fn().mockResolvedValue(undefined),
    }
    const worker = new AutoReloadWorker(
      walletRepo as any,
      stripeService as any,
      dataSource as any,
      notificationsService as any,
    )

    return { worker, walletRepo, queryRunner }
  }

  it('does nothing while the worker is disabled by environment', async () => {
    process.env.AUTO_RELOAD_WORKER_ENABLED = 'false'
    const { worker, walletRepo } = createWorker()

    await worker.runAutoReload()

    expect(walletRepo.createQueryBuilder).not.toHaveBeenCalled()
  })

  it('charges wallets whose balance drops below the threshold', async () => {
    process.env.AUTO_RELOAD_WORKER_ENABLED = 'true'
    const { worker, walletRepo, queryRunner } = createWorker()
    const wallet = buildWallet({
      id: 'wallet-1',
      user: { id: 'buyer-1', stripe_customer_id: 'cus_123' },
      balance_cents: '400',
      auto_reload_enabled: true,
      auto_reload_opt_in: true,
      auto_reload_threshold_cents: '500',
      auto_reload_amount_cents: '2500',
      stripe_payment_method_id: 'pm_123',
    })

    walletRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([wallet]),
      }),
    )
    queryRunner.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce(undefined)
    ;(queryRunner.manager.getRepository as jest.Mock).mockReturnValue({
      createQueryBuilder: jest.fn(() => {
        const qb = createQueryBuilderMock()
        qb.innerJoinAndSelect.mockReturnThis()
        qb.where.mockReturnThis()
        qb.getOne.mockResolvedValue(wallet)
        return qb
      }),
    })

    await worker.runAutoReload()

    expect(stripeService.chargeWalletAutoReload).toHaveBeenCalledWith(
      'buyer-1',
      2500,
      'pm_123',
      'cus_123',
      { balanceCentsForIdempotency: '400' },
    )
  })

  it('does not recharge wallets sitting exactly at the threshold', async () => {
    process.env.AUTO_RELOAD_WORKER_ENABLED = 'true'
    const { worker, walletRepo } = createWorker()
    const wallet = buildWallet({
      balance_cents: '500',
      auto_reload_enabled: true,
      auto_reload_opt_in: true,
      auto_reload_threshold_cents: '500',
      auto_reload_amount_cents: '2500',
      stripe_payment_method_id: 'pm_123',
      user: { id: 'buyer-1', stripe_customer_id: 'cus_123' },
    })

    walletRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([wallet]),
      }),
    )

    await worker.runAutoReload()

    expect(stripeService.chargeWalletAutoReload).not.toHaveBeenCalled()
  })

  it('skips a wallet when another worker already holds the advisory lock', async () => {
    process.env.AUTO_RELOAD_WORKER_ENABLED = 'true'
    const { worker, walletRepo, queryRunner } = createWorker()
    const wallet = buildWallet({
      id: 'wallet-1',
      balance_cents: '400',
      auto_reload_enabled: true,
      auto_reload_opt_in: true,
      auto_reload_threshold_cents: '500',
      auto_reload_amount_cents: '2500',
      stripe_payment_method_id: 'pm_123',
      user: { id: 'buyer-1', stripe_customer_id: 'cus_123' },
    })
    walletRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([wallet]),
      }),
    )
    queryRunner.query.mockResolvedValue([{ locked: false }])

    await worker.runAutoReload()

    expect(stripeService.chargeWalletAutoReload).not.toHaveBeenCalled()
  })
})
