import request from 'supertest'
import { MarketplaceController } from '../../src/leads/marketplace.controller'
import { LeadsService } from '../../src/leads/leads.service'
import { RefundRequestsService } from '../../src/leads/refund-requests.service'
import { JwtAuthGuard } from '../../src/auth/guards/jwt.auth.guard'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { closeHttpApp, createHttpApp } from '../helpers/testing'

describe('MarketplaceController (e2e)', () => {
  const leadsService = {
    listMarketplaceLeads: jest.fn(),
    reserveLead: jest.fn(),
    buyLead: jest.fn(),
    getMyLeads: jest.fn(),
    getLeadDetail: jest.fn(),
    updateMyAssignmentLifecycle: jest.fn(),
  }
  const refundRequestsService = {
    createForBuyer: jest.fn(),
    listMine: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates refund request payloads and forwards valid submissions', async () => {
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
      controllers: [MarketplaceController],
      providers: [
        { provide: LeadsService, useValue: leadsService },
        { provide: RefundRequestsService, useValue: refundRequestsService },
      ],
    })

    await request(app.getHttpServer())
      .post('/leads/me/refund-requests')
      .send({ assignment_id: 'bad-id' })
      .expect(400)

    refundRequestsService.createForBuyer.mockResolvedValue({ id: 'refund-1' })

    await request(app.getHttpServer())
      .post('/leads/me/refund-requests')
      .send({
        assignment_id: 'f4a5034b-2967-4b0b-b8d7-855613c2d0d9',
        reason: 'Duplicate lead',
      })
      .expect(201, { id: 'refund-1' })

    expect(refundRequestsService.createForBuyer).toHaveBeenCalledWith(
      'buyer-1',
      'f4a5034b-2967-4b0b-b8d7-855613c2d0d9',
      'Duplicate lead',
    )

    await closeHttpApp(app)
    jwtSpy.mockRestore()
    rolesSpy.mockRestore()
  })

  it('forwards marketplace buy requests for authenticated buyers', async () => {
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
      controllers: [MarketplaceController],
      providers: [
        { provide: LeadsService, useValue: leadsService },
        { provide: RefundRequestsService, useValue: refundRequestsService },
      ],
    })

    leadsService.buyLead.mockResolvedValue({ id: 'assignment-1' })

    await request(app.getHttpServer())
      .post('/leads/f4a5034b-2967-4b0b-b8d7-855613c2d0d9/buy')
      .send({})
      .expect(201, { id: 'assignment-1' })

    expect(leadsService.buyLead).toHaveBeenCalledWith(
      'buyer-1',
      'f4a5034b-2967-4b0b-b8d7-855613c2d0d9',
    )

    await closeHttpApp(app)
    jwtSpy.mockRestore()
    rolesSpy.mockRestore()
  })
})
