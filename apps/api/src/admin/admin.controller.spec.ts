import { NotFoundException } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { createRepositoryMock } from '../../test/helpers/testing'
import { buildUser } from '../../test/helpers/fixtures'

describe('AdminController', () => {
  const walletService = {
    adminCreditWallet: jest.fn(),
  }
  const auditLogService = {
    append: jest.fn(),
    listRecent: jest.fn(),
  }
  const ghlOutbound = {
    emit: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const metricsService = {
    getBreakdown: jest.fn(),
  }
  const ingestionService = {
    listBatches: jest.fn(),
    getStats: jest.fn(),
    createBatch: jest.fn(),
  }
  const gradingService = {
    getQueue: jest.fn(),
    getStats: jest.fn(),
    listOverrides: jest.fn(),
    createOverride: jest.fn(),
  }
  const integrationsHealthService = {
    getHealth: jest.fn(),
  }
  const plansService = {
    list: jest.fn(),
    patch: jest.fn(),
  }

  function createController() {
    const engineSettingsRepo = createRepositoryMock<any>()
    const userRepo = createRepositoryMock<any>()
    const resourcesRepo = createRepositoryMock<any>()
    const controller = new AdminController(
      walletService as any,
      auditLogService as any,
      ghlOutbound as any,
      metricsService as any,
      ingestionService as any,
      gradingService as any,
      integrationsHealthService as any,
      plansService as any,
      engineSettingsRepo as any,
      userRepo as any,
      resourcesRepo as any,
    )
    return { controller, engineSettingsRepo, userRepo, resourcesRepo }
  }

  it('credits a wallet and writes an audit log entry', async () => {
    const { controller } = createController()

    await expect(
      controller.creditWallet(
        { user: { userId: 'admin-1' } } as any,
        { user_id: 'user-1', amount_cents: 2500, description: 'Manual adjustment' },
        '127.0.0.1',
      ),
    ).resolves.toEqual({ ok: true })

    expect(walletService.adminCreditWallet).toHaveBeenCalledWith(
      'user-1',
      2500,
      'Manual adjustment',
    )
    expect(auditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'admin_wallet_credit',
        targetId: 'user-1',
      }),
    )
    expect(ghlOutbound.emit).toHaveBeenCalledWith(
      'admin_wallet_credit',
      expect.objectContaining({ user_id: 'user-1' }),
    )
  })

  it('throws when setting a distribution lock for a missing user', async () => {
    const { controller, userRepo } = createController()
    userRepo.findOne.mockResolvedValue(null)

    await expect(
      controller.setDistributionLock(
        'f4a5034b-2967-4b0b-b8d7-855613c2d0d9',
        { locked: true },
        { user: { userId: 'admin-1' } } as any,
        '127.0.0.1',
      ),
    ).rejects.toThrow(NotFoundException)
  })

  it('creates default engine settings when none exist', async () => {
    const { controller, engineSettingsRepo } = createController()
    engineSettingsRepo.findOne.mockResolvedValue(null)
    engineSettingsRepo.create.mockImplementation((value) => value)
    engineSettingsRepo.save.mockImplementation(async (value) => value)

    const settings = await controller.getEngineSettings()

    expect(settings).toEqual(
      expect.objectContaining({
        queue_paused: false,
        max_auto_distribution_runs: 10,
      }),
    )
    expect(engineSettingsRepo.save).toHaveBeenCalled()
  })

  it('patches an existing resource item', async () => {
    const { controller, resourcesRepo } = createController()
    const existing = { id: 'resource-1', title: 'Old', body: null, sort_order: 0, is_published: true }
    resourcesRepo.findOne.mockResolvedValue(existing)
    resourcesRepo.save.mockImplementation(async (value) => value)

    const result = await controller.patchResourceItem(
      '8c8260b6-7e17-4513-99dc-f09d0a4d56f8',
      { title: 'Updated title', is_published: false },
    )

    expect(result).toEqual(expect.objectContaining({ title: 'Updated title', is_published: false }))
  })

  it('updates a distribution lock and audits the change', async () => {
    const { controller, userRepo } = createController()
    const user = buildUser({ distribution_locked: false })
    userRepo.findOne.mockResolvedValue(user)
    userRepo.save.mockImplementation(async (value) => value)

    await expect(
      controller.setDistributionLock(
        'f4a5034b-2967-4b0b-b8d7-855613c2d0d9',
        { locked: true },
        { user: { userId: 'admin-1' } } as any,
        '127.0.0.1',
      ),
    ).resolves.toEqual({ ok: true, distribution_locked: true })

    expect(auditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin_distribution_lock',
        targetType: 'user',
      }),
    )
  })
})
