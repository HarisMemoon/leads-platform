import request from 'supertest'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AdminController } from '../../src/admin/admin.controller'
import { WalletService } from '../../src/wallet/wallet.service'
import { AuditLogService } from '../../src/admin/audit-log.service'
import { GhlOutboundService } from '../../src/integrations/ghl-outbound.service'
import { DistributionEngineSettings } from '../../src/entities/distribution-engine-settings.entity'
import { User } from '../../src/entities/user.entity'
import { ResourcesContent } from '../../src/entities/resources-content.entity'
import { JwtAuthGuard } from '../../src/auth/guards/jwt.auth.guard'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { closeHttpApp, createHttpApp, createRepositoryMock } from '../helpers/testing'

describe('AdminController (e2e)', () => {
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

  it('validates wallet credit payloads before invoking the admin service', async () => {
    const jwtSpy = jest
      .spyOn(JwtAuthGuard.prototype as any, 'canActivate')
      .mockImplementation((context: any) => {
        context.switchToHttp().getRequest().user = { userId: 'admin-1', role: 'admin' }
        return true
      })
    const rolesSpy = jest
      .spyOn(RolesGuard.prototype as any, 'canActivate')
      .mockReturnValue(true)
    const { app } = await createHttpApp({
      controllers: [AdminController],
      providers: [
        { provide: WalletService, useValue: walletService },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: GhlOutboundService, useValue: ghlOutbound },
        { provide: getRepositoryToken(DistributionEngineSettings), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(User), useValue: createRepositoryMock() },
        { provide: getRepositoryToken(ResourcesContent), useValue: createRepositoryMock() },
      ],
    })

    await request(app.getHttpServer())
      .post('/admin/wallet/credit')
      .send({ user_id: 'not-a-uuid', amount_cents: 0, description: 'x' })
      .expect(400)

    walletService.adminCreditWallet.mockResolvedValue(undefined)

    await request(app.getHttpServer())
      .post('/admin/wallet/credit')
      .send({
        user_id: 'f4a5034b-2967-4b0b-b8d7-855613c2d0d9',
        amount_cents: 2500,
        description: 'Manual adjustment',
      })
      .expect(201, { ok: true })

    expect(walletService.adminCreditWallet).toHaveBeenCalledWith(
      'f4a5034b-2967-4b0b-b8d7-855613c2d0d9',
      2500,
      'Manual adjustment',
    )

    await closeHttpApp(app)
    jwtSpy.mockRestore()
    rolesSpy.mockRestore()
  })
})
