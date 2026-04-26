import { BadRequestException } from '@nestjs/common'
import { WalletService } from './wallet.service'
import { createDataSourceMock, createQueryBuilderMock, createQueryRunnerMock, createRepositoryMock } from '../../test/helpers/testing'
import { buildUser, buildWallet, buildWalletTransaction } from '../../test/helpers/fixtures'
import { WalletTransactionType } from '../../common/enums/wallet-transaction-type.enum'

describe('WalletService', () => {
  const notificationsService = {
    notifyWalletFunded: jest.fn(),
    notifyWalletCreditPosted: jest.fn(),
  }
  const integrationsService = {
    emitCustomWebhookEvent: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService() {
    const walletRepo = createRepositoryMock<any>()
    const txRepo = createRepositoryMock<any>()
    const queryRunner = createQueryRunnerMock()
    const dataSource = createDataSourceMock(queryRunner)
    const service = new WalletService(
      walletRepo as any,
      txRepo as any,
      dataSource as any,
      notificationsService as any,
      integrationsService as any,
    )

    return { service, walletRepo, txRepo, dataSource, queryRunner }
  }

  it('credits the wallet and emits non-Stripe side effects on topup', async () => {
    const { service, dataSource } = createService()
    const wallet = buildWallet({ balance_cents: '5000' })

    ;(dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      const manager = {
        createQueryBuilder: jest.fn(() => {
          const qb = createQueryBuilderMock()
          qb.getOne.mockResolvedValue(wallet)
          return qb
        }),
        save: jest.fn(async (input) => input),
        create: jest.fn((_: unknown, input: unknown) => input),
      }
      return cb(manager as any)
    })

    const result = await service.topup('user-1', 1500, 'Promo credit', 'promo_credit', 'promo-1')

    expect(result.balance_cents).toBe('6500')
    expect(integrationsService.emitCustomWebhookEvent).toHaveBeenCalledWith(
      'user-1',
      'wallet_credit_posted',
      expect.objectContaining({
        amount_cents: 1500,
        balance_cents: '6500',
        reference_type: 'promo_credit',
      }),
    )
    expect(notificationsService.notifyWalletCreditPosted).toHaveBeenCalledWith(
      'user-1',
      1500,
      '6500',
      'Promo credit',
      'promo-1',
    )
  })

  it('returns the existing wallet for duplicate Stripe top-ups without emitting again', async () => {
    const { service, dataSource } = createService()
    const priorWallet = buildWallet({ user: buildUser({ id: 'user-1' }), balance_cents: '7500' })
    const prior = buildWalletTransaction({ wallet: priorWallet })

    ;(dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      const manager = {
        query: jest.fn(),
        createQueryBuilder: jest.fn(() => {
          const qb = createQueryBuilderMock()
          qb.getOne.mockResolvedValue(prior)
          return qb
        }),
        findOneOrFail: jest.fn().mockResolvedValue(priorWallet),
      }
      return cb(manager as any)
    })

    const result = await service.applyStripeTopUp('user-1', 2000, 'pi_123')

    expect(result).toBe(priorWallet)
    expect(notificationsService.notifyWalletFunded).not.toHaveBeenCalled()
    expect(integrationsService.emitCustomWebhookEvent).not.toHaveBeenCalled()
  })

  it('rejects a duplicate Stripe top-up replay for a different user', async () => {
    const { service, dataSource } = createService()
    const prior = buildWalletTransaction({
      wallet: buildWallet({ user: buildUser({ id: 'another-user' }) }),
    })

    ;(dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      const manager = {
        query: jest.fn(),
        createQueryBuilder: jest.fn(() => {
          const qb = createQueryBuilderMock()
          qb.getOne.mockResolvedValue(prior)
          return qb
        }),
      }
      return cb(manager as any)
    })

    await expect(service.applyStripeTopUp('user-1', 2000, 'pi_123')).rejects.toThrow(
      BadRequestException,
    )
  })

  it('applies an idempotent credit once and trims the reference values', async () => {
    const { service, dataSource } = createService()
    const wallet = buildWallet({ balance_cents: '5000' })

    ;(dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      const manager = {
        query: jest.fn(),
        createQueryBuilder: jest.fn(() => {
          const qb = createQueryBuilderMock()
          qb.getOne.mockResolvedValue(null)
          return qb
        }),
        findOne: jest.fn().mockResolvedValue(wallet),
        save: jest.fn(async (input) => input),
        create: jest.fn((_: unknown, input: unknown) => input),
      }
      return cb(manager as any)
    })

    await service.applyIdempotentCredit(
      'user-1',
      1000,
      ' invoice_credit ',
      ' inv_1 ',
      'Invoice wallet credit',
    )

    expect(wallet.balance_cents).toBe('6000')
    expect(integrationsService.emitCustomWebhookEvent).toHaveBeenCalledWith(
      'user-1',
      'wallet_credit_posted',
      expect.objectContaining({
        reference_type: 'invoice_credit',
        reference_id: 'inv_1',
      }),
    )
  })

  it('requires threshold and amount when enabling auto-reload', async () => {
    const { service, walletRepo } = createService()
    walletRepo.findOne.mockResolvedValue(buildWallet())

    await expect(
      service.updateAutoReload('user-1', { auto_reload_enabled: true } as any),
    ).rejects.toThrow(BadRequestException)
  })

  it('requires opt-in and a saved card before enabling auto-reload', async () => {
    const { service, walletRepo } = createService()
    walletRepo.findOne.mockResolvedValue(buildWallet({ auto_reload_opt_in: false }))

    await expect(
      service.updateAutoReload('user-1', {
        auto_reload_enabled: true,
        auto_reload_threshold_cents: 1000,
        auto_reload_amount_cents: 2500,
      }),
    ).rejects.toThrow('Enable auto-reload only after you save a card')

    walletRepo.findOne.mockResolvedValue(
      buildWallet({ auto_reload_opt_in: true, stripe_payment_method_id: null }),
    )

    await expect(
      service.updateAutoReload('user-1', {
        auto_reload_enabled: true,
        auto_reload_threshold_cents: 1000,
        auto_reload_amount_cents: 2500,
      }),
    ).rejects.toThrow('No saved card on file')
  })

  it('debits the wallet inside a transaction and records a debit row', async () => {
    const { service, queryRunner } = createService()
    const wallet = buildWallet({ balance_cents: '5000' })
    ;(queryRunner.manager.findOne as jest.Mock).mockResolvedValue(wallet)

    await service.debitWallet('user-1', 1250, 'lead_purchase', 'lead-1', 'Lead purchase')

    expect(wallet.balance_cents).toBe('3750')
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: WalletTransactionType.DEBIT,
        amount_cents: '1250',
        reference_type: 'lead_purchase',
        reference_id: 'lead-1',
      }),
    )
    expect(queryRunner.commitTransaction).toHaveBeenCalled()
  })

  it('rolls back debitWallet when the wallet balance is insufficient', async () => {
    const { service, queryRunner } = createService()
    ;(queryRunner.manager.findOne as jest.Mock).mockResolvedValue(buildWallet({ balance_cents: '500' }))

    await expect(
      service.debitWallet('user-1', 1250, 'lead_purchase', 'lead-1', 'Lead purchase'),
    ).rejects.toThrow('Insufficient wallet balance')

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled()
  })

  it('credits via admin flow and emits side effects after commit', async () => {
    const { service, queryRunner } = createService()
    const wallet = buildWallet({ balance_cents: '3000' })
    ;(queryRunner.manager.findOne as jest.Mock).mockResolvedValue(wallet)

    await service.adminCreditWallet('user-1', 700, 'Replacement credit')

    expect(wallet.balance_cents).toBe('3700')
    expect(queryRunner.commitTransaction).toHaveBeenCalled()
    expect(notificationsService.notifyWalletCreditPosted).toHaveBeenCalledWith(
      'user-1',
      700,
      '3700',
      'Replacement credit',
      null,
    )
  })
})
