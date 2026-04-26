import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { RefundRequestStatus } from '../../common/enums/refund-request-status.enum'
import { PurchaseType } from '../../common/enums/purchase-type.enum'
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum'
import { RefundRequestsService } from './refund-requests.service'
import { createQueryBuilderMock, createRepositoryMock } from '../../test/helpers/testing'
import { buildAssignment, buildLead, buildSubscription, buildUser } from '../../test/helpers/fixtures'

describe('RefundRequestsService', () => {
  const walletService = {
    topup: jest.fn(),
  }
  const ghlOutbound = {
    emit: jest.fn(),
  }
  const notificationsService = {
    notifyRefundResolved: jest.fn(),
  }
  const integrationsService = {
    emitCustomWebhookEvent: jest.fn(),
  }
  const distributionService = {
    enqueueLeadDistribution: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createService() {
    const refundRepo = createRepositoryMock<any>()
    const assignmentRepo = createRepositoryMock<any>()
    const leadRepo = createRepositoryMock<any>()
    const subscriptionRepo = createRepositoryMock<any>()

    const service = new RefundRequestsService(
      refundRepo as any,
      assignmentRepo as any,
      leadRepo as any,
      subscriptionRepo as any,
      walletService as any,
      ghlOutbound as any,
      notificationsService as any,
      integrationsService as any,
      distributionService as any,
    )

    return { service, refundRepo, assignmentRepo, leadRepo, subscriptionRepo }
  }

  it('prevents a buyer from creating a refund request for someone else', async () => {
    const { service, assignmentRepo } = createService()
    assignmentRepo.findOne.mockResolvedValue(buildAssignment({ buyer: buildUser({ id: 'other-buyer' }) }))

    await expect(
      service.createForBuyer('buyer-1', 'assignment-1', 'duplicate lead'),
    ).rejects.toThrow(ForbiddenException)
  })

  it('rejects duplicate pending refund requests for the same assignment', async () => {
    const { service, assignmentRepo, refundRepo } = createService()
    assignmentRepo.findOne.mockResolvedValue(buildAssignment({ buyer: buildUser({ id: 'buyer-1' }) }))
    refundRepo.createQueryBuilder.mockReturnValue(
      Object.assign(createQueryBuilderMock(), {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'refund-1' }),
      }),
    )

    await expect(
      service.createForBuyer('buyer-1', 'assignment-1', 'duplicate lead'),
    ).rejects.toThrow('A pending refund already exists for this lead')
  })

  it('requires a resolution when an admin approves a refund', async () => {
    const { service, refundRepo } = createService()
    refundRepo.findOne.mockResolvedValue({
      id: 'refund-1',
      status: RefundRequestStatus.PENDING,
      buyer: buildUser(),
      lead_assignment: buildAssignment(),
    })

    await expect(service.resolveAdmin('refund-1', 'approved', 'ok', undefined)).rejects.toThrow(
      BadRequestException,
    )
  })

  it('credits the buyer wallet and requeues duplicate leads for approved wallet refunds', async () => {
    const { service, refundRepo, leadRepo } = createService()
    const lead = buildLead({ duplicate_of_lead: buildLead({ id: 'canonical-1' }) })
    const assignment = buildAssignment({
      buyer: buildUser({ id: 'buyer-1' }),
      lead,
      purchase_type: PurchaseType.MANUAL,
      amount_charged_cents: '1500',
    })
    const refund = {
      id: 'refund-1',
      status: RefundRequestStatus.PENDING,
      reason: 'Duplicate seller record',
      admin_notes: null,
      buyer: buildUser({ id: 'buyer-1' }),
      lead_assignment: assignment,
      resolution: null,
    }
    refundRepo.findOne.mockResolvedValue(refund)
    refundRepo.save.mockImplementation(async (value) => value)
    leadRepo.save.mockImplementation(async (value) => value)

    const result = await service.resolveAdmin(
      'refund-1',
      'approved',
      'Approved duplicate',
      'wallet_credit',
    )

    expect(result.status).toBe(RefundRequestStatus.APPROVED)
    expect(walletService.topup).toHaveBeenCalledWith(
      'buyer-1',
      1500,
      'Lead purchase refund',
      'refund_approved',
      'refund-1',
    )
    expect(lead.status).toBe('available')
    expect(distributionService.enqueueLeadDistribution).toHaveBeenCalledWith(lead.id)
  })

  it('decrements subscription usage for approved premium-credit refunds', async () => {
    const { service, refundRepo, subscriptionRepo } = createService()
    const assignment = buildAssignment({
      buyer: buildUser({ id: 'buyer-1' }),
      purchase_type: PurchaseType.SUBSCRIPTION_DISTRIBUTION,
      amount_charged_cents: '1500',
    })
    const refund = {
      id: 'refund-1',
      status: RefundRequestStatus.PENDING,
      reason: 'bad phone number',
      admin_notes: null,
      buyer: buildUser({ id: 'buyer-1' }),
      lead_assignment: assignment,
      resolution: null,
    }
    const subscription = buildSubscription({
      leads_used_this_period: 4,
      status: SubscriptionStatus.ACTIVE,
    })
    refundRepo.findOne.mockResolvedValue(refund)
    refundRepo.save.mockImplementation(async (value) => value)
    subscriptionRepo.findOne.mockResolvedValue(subscription)

    await service.resolveAdmin('refund-1', 'approved', undefined, 'premium_credit')

    expect(subscription.leads_used_this_period).toBe(3)
    expect(subscriptionRepo.save).toHaveBeenCalledWith(subscription)
  })

  it('sends rejection notifications when an admin rejects a refund', async () => {
    const { service, refundRepo } = createService()
    const refund = {
      id: 'refund-1',
      status: RefundRequestStatus.PENDING,
      reason: 'not interested',
      admin_notes: null,
      buyer: buildUser({ id: 'buyer-1' }),
      lead_assignment: buildAssignment({ buyer: buildUser({ id: 'buyer-1' }) }),
      resolution: null,
    }
    refundRepo.findOne.mockResolvedValue(refund)
    refundRepo.save.mockImplementation(async (value) => value)

    await service.resolveAdmin('refund-1', 'rejected', 'No issue found', undefined)

    expect(notificationsService.notifyRefundResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-1',
        approved: false,
      }),
    )
    expect(integrationsService.emitCustomWebhookEvent).toHaveBeenCalledWith(
      'buyer-1',
      'refund_rejected',
      expect.any(Object),
    )
  })
})
