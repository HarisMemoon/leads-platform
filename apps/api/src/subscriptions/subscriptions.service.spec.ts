import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PlanType } from '../../common/enums/plan-type.enum'
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum'
import { SubscriptionsService } from './subscriptions.service'
import { createRepositoryMock } from '../../test/helpers/testing'
import { buildSubscription, buildUser } from '../../test/helpers/fixtures'

const stripeClientMock = {
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  subscriptions: {
    cancel: jest.fn(),
  },
}

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => stripeClientMock)
})

describe('SubscriptionsService', () => {
  const stripeService = {
    ensureStripeCustomerId: jest.fn(),
  }

  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      STRIPE_PRICE_ID_BASIC: 'price_basic',
      STRIPE_PRICE_ID_PRO: 'price_pro',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  function createService() {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_123',
          APP_BASE_URL: 'https://app.example.com',
        }
        return values[key]
      }),
    } as unknown as ConfigService
    const userRepo = createRepositoryMock<any>()
    const subscriptionRepo = createRepositoryMock<any>()
    const planRepo = createRepositoryMock<any>()
    planRepo.find.mockResolvedValue([])
    const service = new SubscriptionsService(
      config,
      stripeService as any,
      userRepo as any,
      subscriptionRepo as any,
      planRepo as any,
    )

    return { service, userRepo, subscriptionRepo, planRepo }
  }

  it('marks plan catalog entries as Stripe-configured when price IDs exist', async () => {
    const { service } = createService()

    const catalog = await service.getPlanCatalog()

    expect(catalog.find((item) => item.planType === PlanType.BASIC)?.stripeConfigured).toBe(true)
    expect(catalog.find((item) => item.planType === PlanType.PRO)?.stripeConfigured).toBe(true)
  })

  it('rejects unsupported plan types during checkout', async () => {
    const { service } = createService()

    await expect(service.checkout('user-1', PlanType.PREMIUM)).rejects.toThrow(
      BadRequestException,
    )
  })

  it('rejects checkout when the user already has an active-like subscription', async () => {
    const { service, userRepo, subscriptionRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser())
    subscriptionRepo.findOne.mockResolvedValue(buildSubscription())

    await expect(service.checkout('user-1', PlanType.BASIC)).rejects.toThrow(
      'You already have a subscription',
    )
  })

  it('creates a Stripe checkout session for a valid plan', async () => {
    const { service, userRepo, subscriptionRepo } = createService()
    userRepo.findOne
      .mockResolvedValueOnce(buildUser({ stripe_customer_id: null }))
      .mockResolvedValueOnce(buildUser({ stripe_customer_id: 'cus_123' }))
    subscriptionRepo.findOne.mockResolvedValue(null)
    stripeClientMock.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.example.com/session',
    })

    const result = await service.checkout('user-1', PlanType.BASIC)

    expect(result).toEqual({ url: 'https://checkout.example.com/session' })
    expect(stripeService.ensureStripeCustomerId).toHaveBeenCalledWith('user-1')
    expect(stripeClientMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_123',
        metadata: {
          userId: 'user-1',
          planType: PlanType.BASIC,
        },
      }),
    )
  })

  it('throws when the user does not exist during checkout', async () => {
    const { service, userRepo } = createService()
    userRepo.findOne.mockResolvedValue(null)

    await expect(service.checkout('missing-user', PlanType.BASIC)).rejects.toThrow(
      NotFoundException,
    )
  })

  it('cancels the current subscription in Stripe and saves the local record', async () => {
    const { service, subscriptionRepo } = createService()
    const subscription = buildSubscription({
      status: SubscriptionStatus.ACTIVE,
      stripe_subscription_id: 'sub_live',
    })
    subscriptionRepo.findOne.mockResolvedValue(subscription)

    await service.cancel('user-1')

    expect(stripeClientMock.subscriptions.cancel).toHaveBeenCalledWith('sub_live')
    expect(subscription.status).toBe(SubscriptionStatus.CANCELLED)
    expect(subscriptionRepo.save).toHaveBeenCalledWith(subscription)
  })

  it('throws when Stripe price IDs are missing for a plan', async () => {
    process.env = {
      ...originalEnv,
      STRIPE_PRICE_ID_BASIC: '',
      STRIPE_PRICE_ID_PRO: 'price_pro',
    }
    const { service, userRepo, subscriptionRepo } = createService()
    userRepo.findOne.mockResolvedValue(buildUser({ stripe_customer_id: 'cus_123' }))
    subscriptionRepo.findOne.mockResolvedValue(null)

    await expect(service.checkout('user-1', PlanType.BASIC)).rejects.toThrow(
      'Stripe price ID not configured for basic',
    )
  })
})
