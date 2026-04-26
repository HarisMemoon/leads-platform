import request from 'supertest'
import { DistributionRulesController } from '../../src/distribution/distribution-rules.controller'
import { DistributionRulesService } from '../../src/distribution/distribution-rules.service'
import { JwtAuthGuard } from '../../src/auth/guards/jwt.auth.guard'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { closeHttpApp, createHttpApp } from '../helpers/testing'

describe('DistributionRulesController (e2e)', () => {
  const distributionRulesService = {
    listForUser: jest.fn(),
    updateOwnRule: jest.fn(),
    getMe: jest.fn(),
    upsertMe: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates distribution rule patch payloads before forwarding them', async () => {
    const jwtSpy = jest
      .spyOn(JwtAuthGuard.prototype as any, 'canActivate')
      .mockImplementation((context: any) => {
        context.switchToHttp().getRequest().user = { userId: 'buyer-1', role: 'buyer' }
        return true
      })
    const rolesSpy = jest
      .spyOn(RolesGuard.prototype as any, 'canActivate')
      .mockReturnValue(true)
    const { app } = await createHttpApp({
      controllers: [DistributionRulesController],
      providers: [
        { provide: DistributionRulesService, useValue: distributionRulesService },
      ],
    })

    await request(app.getHttpServer())
      .patch('/distribution/me')
      .send({ max_per_day: -1 })
      .expect(400)

    distributionRulesService.upsertMe.mockResolvedValue({ id: 'rule-1', max_per_day: 4 })

    await request(app.getHttpServer())
      .patch('/distribution/me')
      .send({ participation_enabled: true, max_per_day: 4, market_filters: ['Dallas'] })
      .expect(200, { id: 'rule-1', max_per_day: 4 })

    expect(distributionRulesService.upsertMe).toHaveBeenCalledWith(
      'buyer-1',
      expect.objectContaining({
        participation_enabled: true,
        max_per_day: 4,
        market_filters: ['Dallas'],
      }),
    )

    await closeHttpApp(app)
    jwtSpy.mockRestore()
    rolesSpy.mockRestore()
  })
})
