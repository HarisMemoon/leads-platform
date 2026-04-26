import { NotFoundException } from '@nestjs/common'
import { OnboardingService } from './onboarding.service'
import { createDataSourceMock, createRepositoryMock } from '../../test/helpers/testing'

describe('OnboardingService', () => {
  const walletService = {
    topup: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService() {
    const repo = createRepositoryMock<any>()
    const dataSource = createDataSourceMock()
    const service = new OnboardingService(repo as any, walletService as any, dataSource as any)
    return { service, repo, dataSource }
  }

  it('throws when onboarding progress does not exist', async () => {
    const { service, repo } = createService()
    repo.findOne.mockResolvedValue(null)

    await expect(service.get('user-1')).rejects.toThrow(NotFoundException)
  })

  it('credits initial onboarding funding exactly once on first completion', async () => {
    const { service, dataSource } = createService()
    const row = {
      user: { id: 'user-1' },
      current_step: 4,
      completed_steps: [1, 2, 3],
      data: {
        wallet_amount: '500',
      },
      completed_at: null,
    }
    ;(dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      const manager = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          innerJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(row),
        })),
        save: jest.fn(async (value) => value),
        query: jest.fn(),
      }
      return cb(manager as any)
    })

    await service.update('user-1', {
      current_step: 9,
      completed_steps: [4, 5],
      completed_at: new Date('2026-04-23T00:00:00.000Z'),
      data: {
        auto_buy: true,
        markets: ['Dallas'],
        lead_types: ['seller'],
        budget: '1500',
        min_balance: '50',
      },
    } as any)

    expect(walletService.topup).toHaveBeenCalledWith(
      'user-1',
      50000,
      'Onboarding initial funding',
      'onboarding_initial',
      'user-1',
      expect.any(Object),
    )
  })

  it('skips synthetic initial funding when Stripe already funded onboarding', async () => {
    const { service, dataSource } = createService()
    const row = {
      user: { id: 'user-1' },
      current_step: 4,
      completed_steps: [1, 2, 3],
      data: {
        wallet_amount: '500',
        stripe_onboarding_funded: true,
      },
      completed_at: null,
    }
    ;(dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      const manager = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          innerJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(row),
        })),
        save: jest.fn(async (value) => value),
        query: jest.fn(),
      }
      return cb(manager as any)
    })

    await service.update('user-1', {
      completed_at: new Date('2026-04-23T00:00:00.000Z'),
    } as any)

    expect(walletService.topup).not.toHaveBeenCalled()
  })

  it('syncs distribution preferences once step five data is present', async () => {
    const { service, dataSource } = createService()
    const row = {
      user: { id: 'user-1' },
      current_step: 5,
      completed_steps: [1, 2, 3, 4, 5],
      data: {},
      completed_at: null,
    }
    const query = jest.fn()
    ;(dataSource.transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      const manager = {
        createQueryBuilder: jest.fn(() => ({
          setLock: jest.fn().mockReturnThis(),
          innerJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(row),
        })),
        save: jest.fn(async (value) => value),
        query,
      }
      return cb(manager as any)
    })

    await service.update('user-1', {
      data: {
        auto_buy: true,
        max_per_day: '3',
        min_balance: '25',
        budget: '1200',
        markets: ['Dallas'],
        lead_types: ['seller'],
      },
    } as any)

    expect(query).toHaveBeenCalled()
  })
})
