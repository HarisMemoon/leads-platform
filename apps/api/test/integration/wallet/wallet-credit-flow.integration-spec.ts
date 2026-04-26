import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { WalletService } from '../../../src/wallet/wallet.service'
import { WalletAccount } from '../../../src/entities/wallet-account.entity'
import { WalletTransaction } from '../../../src/entities/wallet-transaction.entity'
import { NotificationsService } from '../../../src/notifications/notifications.service'
import { IntegrationsService } from '../../../src/integrations/integrations.service'
import { createDataSourceMock, createQueryBuilderMock, createRepositoryMock } from '../../helpers/testing'
import { buildWallet } from '../../helpers/fixtures'

describe('Wallet credit flow (integration)', () => {
  it('wires wallet credits through Nest DI and emits downstream side effects once', async () => {
    const walletRepo = createRepositoryMock<any>()
    const txRepo = createRepositoryMock<any>()
    const dataSource = createDataSourceMock()
    const notificationsService = {
      notifyWalletFunded: jest.fn(),
      notifyWalletCreditPosted: jest.fn(),
    }
    const integrationsService = {
      emitCustomWebhookEvent: jest.fn(),
    }
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(WalletAccount), useValue: walletRepo },
        { provide: getRepositoryToken(WalletTransaction), useValue: txRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: IntegrationsService, useValue: integrationsService },
      ],
    }).compile()

    const service = moduleRef.get(WalletService)
    await service.topup('user-1', 1000, 'Integration credit', 'integration_credit', 'int-1')

    expect(wallet.balance_cents).toBe('6000')
    expect(integrationsService.emitCustomWebhookEvent).toHaveBeenCalledTimes(1)
    expect(notificationsService.notifyWalletCreditPosted).toHaveBeenCalledTimes(1)
  })
})
